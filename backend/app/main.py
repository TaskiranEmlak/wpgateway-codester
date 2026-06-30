import os
import json
from datetime import datetime, timedelta
from uuid import UUID
from typing import Optional, List
import requests
import redis
from fastapi import FastAPI, Depends, HTTPException, Header, status, Security, File, UploadFile
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import Base, engine, get_db
from app.core import security
from app import models, schemas
from pydantic import BaseModel

# Initialize database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Enterprise WhatsApp Gateway API", version="1.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis Client
redis_client = redis.Redis.from_url(settings.REDIS_URL)

# OAuth2 / API Key definitions
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# --- DEPENDENCIES ---

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme), 
    api_key: Optional[str] = Depends(api_key_header),
    db: Session = Depends(get_db)
) -> models.User:
    """
    Authenticates requests using either a JWT Bearer token (dashboard users)
    or an X-API-Key header (external integrations/OTP API).
    """
    if api_key:
        user = db.query(models.User).filter(models.User.api_key == api_key).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API Key")
        return user
        
    if token:
        payload = security.verify_access_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token or token expired")
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        user = db.query(models.User).filter(models.User.username == username).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
        
    raise HTTPException(
        status_code=401, 
        detail="Not authenticated. Provide Authorization header or X-API-Key header."
    )

# --- AUTH & SAAS MODULES ---

@app.post("/api/v1/auth/register", response_model=schemas.UserResponse)
def register(user_in: schemas.UserRegister, db: Session = Depends(get_db)):
    # Check duplicate username
    db_user = db.query(models.User).filter(models.User.username == user_in.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    # Check duplicate email
    db_email = db.query(models.User).filter(models.User.email == user_in.email).first()
    if db_email:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_pwd = security.get_password_hash(user_in.password)
    api_key = security.generate_api_key()
    
    new_user = models.User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_pwd,
        api_key=api_key,
        credits=1000 # Give 1000 free starting credits
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/v1/auth/token", response_model=schemas.Token)
def login(user_in: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == user_in.username).first()
    if not user or not security.verify_password(user_in.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
        
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/v1/auth/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.post("/api/v1/auth/webhook")
def update_webhook(webhook_in: schemas.WebhookConfigUpdate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.webhook_url = webhook_in.webhook_url
    db.commit()
    return {"message": "Webhook URL updated successfully.", "webhook_url": current_user.webhook_url}

@app.post("/api/v1/auth/credits")
def buy_credits(req: schemas.CreditAddRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    SaaS Simulation: Allows users to add credits directly from the dashboard.
    """
    current_user.credits += req.amount
    db.commit()
    return {"message": f"Successfully purchased {req.amount} credits.", "credits": current_user.credits}

# --- DEVICE MANAGEMENT MODULE ---

@app.get("/api/v1/devices", response_model=List[schemas.DeviceResponse])
def list_devices(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Device).filter(models.Device.user_id == current_user.id).all()

@app.post("/api/v1/devices", response_model=schemas.DeviceResponse)
def create_device(device_in: schemas.DeviceCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    new_device = models.Device(
        user_id=current_user.id,
        name=device_in.name,
        proxy_url=device_in.proxy_url,
        status="disconnected"
    )
    db.add(new_device)
    db.commit()
    db.refresh(new_device)
    
    # Trigger connection initiation in Node.js
    try:
        url = f"{settings.WHATSAPP_SERVICE_URL}/sessions/{new_device.id}/start"
        requests.post(url, timeout=5)
    except Exception as e:
        # Log error, but don't fail device registration
        print(f"Error starting Node.js session: {e}")
        
    return new_device

@app.delete("/api/v1/devices/{device_id}")
def delete_device(device_id: UUID, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(
        models.Device.id == device_id, 
        models.Device.user_id == current_user.id
    ).first()
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    # Stop session in Node.js
    try:
        url = f"{settings.WHATSAPP_SERVICE_URL}/sessions/{device.id}/stop"
        requests.post(url, timeout=5)
    except Exception as e:
        print(f"Error stopping Node.js session: {e}")
        
    db.delete(device)
    db.commit()
    return {"message": "Device deleted successfully."}

@app.post("/api/v1/devices/{device_id}/start")
def start_device(device_id: UUID, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(
        models.Device.id == device_id, 
        models.Device.user_id == current_user.id
    ).first()
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    try:
        url = f"{settings.WHATSAPP_SERVICE_URL}/sessions/{device.id}/start"
        res = requests.post(url, timeout=5)
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.json().get("error"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to WhatsApp engine: {e}")
        
    return {"message": "WhatsApp service initialization triggered."}

@app.post("/api/v1/devices/{device_id}/stop")
def stop_device(device_id: UUID, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(
        models.Device.id == device_id, 
        models.Device.user_id == current_user.id
    ).first()
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    try:
        url = f"{settings.WHATSAPP_SERVICE_URL}/sessions/{device.id}/stop"
        res = requests.post(url, timeout=5)
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.json().get("error"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to WhatsApp engine: {e}")
        
    return {"message": "WhatsApp connection stopped."}

@app.get("/api/v1/devices/{device_id}/qr")
def get_device_qr(device_id: UUID, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(
        models.Device.id == device_id, 
        models.Device.user_id == current_user.id
    ).first()
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    # Request QR code from Node.js
    try:
        url = f"{settings.WHATSAPP_SERVICE_URL}/sessions/{device.id}/qr"
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail="Failed to fetch QR code")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to WhatsApp engine: {e}")

class DevicePairRequest(BaseModel):
    phone_number: Optional[str] = None
    phoneNumber: Optional[str] = None

@app.post("/api/v1/devices/{device_id}/pair")
def pair_device(
    device_id: UUID,
    payload: DevicePairRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.id == device_id, 
        models.Device.user_id == current_user.id
    ).first()
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    phone_num = payload.phone_number or payload.phoneNumber
    if not phone_num:
        raise HTTPException(status_code=400, detail="phone_number or phoneNumber is required")
        
    try:
        url = f"{settings.WHATSAPP_SERVICE_URL}/sessions/{device.id}/pair"
        res = requests.post(url, json={"phone_number": phone_num}, timeout=15)
        if res.status_code == 200:
            return res.json()
        raise HTTPException(status_code=res.status_code, detail=res.json().get("error", "Failed to request pairing code"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to WhatsApp engine: {e}")

@app.put("/api/v1/devices/{device_id}", response_model=schemas.DeviceResponse)
def update_device_settings(
    device_id: UUID, 
    device_up: schemas.DeviceUpdate, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(
        models.Device.id == device_id, 
        models.Device.user_id == current_user.id
    ).first()
    
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    if device_up.name is not None:
        device.name = device_up.name
    if device_up.proxy_url is not None:
        device.proxy_url = device_up.proxy_url
    if device_up.ai_enabled is not None:
        device.ai_enabled = device_up.ai_enabled
    if device_up.ai_prompt is not None:
        device.ai_prompt = device_up.ai_prompt
        
    db.commit()
    db.refresh(device)
    
    # Notify Node.js if proxy or AI prompt has changed (simply trigger session start which re-reads database config)
    if device_up.proxy_url is not None or device_up.ai_enabled is not None:
        try:
            # Re-read configurations by doing start session
            requests.post(f"{settings.WHATSAPP_SERVICE_URL}/sessions/{device.id}/start", timeout=5)
        except Exception:
            pass

    return device

# --- AUTO RESPONDERS MODULE ---

@app.get("/api/v1/devices/{device_id}/auto-responders", response_model=List[schemas.AutoResponderResponse])
def get_auto_responders(device_id: UUID, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    device = db.query(models.Device).filter(models.Device.id == device_id, models.Device.user_id == current_user.id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return db.query(models.AutoResponder).filter(models.AutoResponder.device_id == device_id).all()

@app.post("/api/v1/devices/{device_id}/auto-responders", response_model=schemas.AutoResponderResponse)
def create_auto_responder(
    device_id: UUID, 
    responder_in: schemas.AutoResponderCreate, 
    current_user: models.User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    device = db.query(models.Device).filter(models.Device.id == device_id, models.Device.user_id == current_user.id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    # Check duplicate keyword
    existing = db.query(models.AutoResponder).filter(
        models.AutoResponder.device_id == device_id,
        models.AutoResponder.trigger_keyword == responder_in.trigger_keyword.strip()
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Auto-responder for this keyword already exists.")

    new_responder = models.AutoResponder(
        device_id=device_id,
        trigger_keyword=responder_in.trigger_keyword.strip(),
        reply_text=responder_in.reply_text,
        is_wildcard=responder_in.is_wildcard
    )
    db.add(new_responder)
    db.commit()
    db.refresh(new_responder)
    return new_responder

@app.delete("/api/v1/auto-responders/{responder_id}")
def delete_auto_responder(responder_id: UUID, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    responder = db.query(models.AutoResponder).join(models.Device).filter(
        models.AutoResponder.id == responder_id,
        models.Device.user_id == current_user.id
    ).first()
    if not responder:
        raise HTTPException(status_code=404, detail="Auto responder not found.")
    db.delete(responder)
    db.commit()
    return {"message": "Auto-responder deleted successfully."}

# --- MESSAGING ENDPOINTS ---

@app.post("/api/v1/send-otp", status_code=status.HTTP_202_ACCEPTED)
def send_otp(msg_in: schemas.OTPMessageSend, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    High-priority OTP Message Dispatch.
    Immediately deducts 1 credit, logs task, and pushes to Redis queue:otp.
    """
    if current_user.credits < 1:
        raise HTTPException(status_code=402, detail="Insufficient credits for OTP dispatch.")

    # 1. Create message log
    msg_log = models.MessageLog(
        user_id=current_user.id,
        recipient=msg_in.recipient,
        message_text=msg_in.message_text,
        type="otp",
        status="queued"
    )
    db.add(msg_log)
    
    # 2. Deduct credit
    current_user.credits -= 1
    db.commit()
    db.refresh(msg_log)

    # 3. Push to Redis otp queue
    payload = {
        "message_log_id": str(msg_log.id),
        "recipient": msg_in.recipient,
        "message_text": msg_in.message_text
    }
    redis_client.rpush("queue:otp_high_priority", json.dumps(payload))

    return {
        "message": "OTP message queued successfully.",
        "message_id": msg_log.id,
        "status": "queued"
    }

@app.post("/api/v1/send-bulk", status_code=status.HTTP_202_ACCEPTED)
def send_bulk(campaign_in: schemas.CampaignCreate, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Bulk Marketing Campaign Dispatch.
    Validates credits, saves Campaign metadata, and schedules/dispatches Celery task.
    """
    recipient_count = len(campaign_in.recipients)
    if recipient_count == 0:
        raise HTTPException(status_code=400, detail="Recipients list cannot be empty.")

    if current_user.credits < recipient_count:
        raise HTTPException(
            status_code=402, 
            detail=f"Insufficient credits. Required: {recipient_count}, Balance: {current_user.credits}"
        )

    # Verify device pool belongs to the user and at least one is connected
    db_devices = db.query(models.Device).filter(
        models.Device.id.in_(campaign_in.device_ids),
        models.Device.user_id == current_user.id
    ).all()

    if len(db_devices) != len(campaign_in.device_ids):
        raise HTTPException(status_code=400, detail="Some devices in your pool do not belong to you.")

    connected_count = sum(1 for d in db_devices if d.status == "connected")
    if connected_count == 0:
        raise HTTPException(status_code=400, detail="All devices in your pool are disconnected. Connect at least one device.")

    # Create Campaign record
    new_campaign = models.Campaign(
        user_id=current_user.id,
        name=campaign_in.name,
        status="pending" if campaign_in.scheduled_for else "processing",
        total_messages=recipient_count,
        scheduled_for=campaign_in.scheduled_for
    )
    db.add(new_campaign)
    db.commit()
    db.refresh(new_campaign)

    # Enqueue Celery Task
    # If scheduled_for is defined, execute Celery ETA
    eta = campaign_in.scheduled_for
    
    from app.tasks.campaign import send_campaign_task
    
    device_id_strs = [str(d_id) for d_id in campaign_in.device_ids]
    
    if eta:
        send_campaign_task.apply_async(
            args=[
                str(new_campaign.id),
                device_id_strs,
                campaign_in.min_delay,
                campaign_in.max_delay,
                campaign_in.recipients,
                campaign_in.message_text,
                campaign_in.media_url,
                campaign_in.media_type
            ],
            eta=eta
        )
    else:
        send_campaign_task.delay(
            str(new_campaign.id),
            device_id_strs,
            campaign_in.min_delay,
            campaign_in.max_delay,
            campaign_in.recipients,
            campaign_in.message_text,
            campaign_in.media_url,
            campaign_in.media_type
        )

    return {
        "message": "Bulk marketing campaign queued successfully.",
        "campaign_id": new_campaign.id,
        "total_messages": recipient_count,
        "scheduled_for": eta
    }

# --- CAMPAIGN CONTROL & ANALYTICS ---

@app.get("/api/v1/campaigns", response_model=List[schemas.CampaignResponse])
def get_campaigns(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Campaign).filter(models.Campaign.user_id == current_user.id).order_by(models.Campaign.created_at.desc()).all()

@app.get("/api/v1/campaigns/{campaign_id}")
def get_campaign_detail(campaign_id: UUID, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    campaign = db.query(models.Campaign).filter(
        models.Campaign.id == campaign_id,
        models.Campaign.user_id == current_user.id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # Fetch last 50 logs of the campaign
    logs = db.query(models.MessageLog).filter(
        models.MessageLog.campaign_id == campaign_id
    ).order_by(models.MessageLog.created_at.desc()).limit(100).all()

    # Calculate success percentages
    success_rate = 0.0
    if campaign.total_messages > 0:
        success_rate = round((campaign.sent_messages / campaign.total_messages) * 100, 2)

    return {
        "campaign": campaign,
        "success_rate": success_rate,
        "recent_logs": logs
    }

@app.post("/api/v1/campaigns/{campaign_id}/pause")
def pause_campaign(campaign_id: UUID, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    campaign = db.query(models.Campaign).filter(
        models.Campaign.id == campaign_id,
        models.Campaign.user_id == current_user.id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status != "processing":
        raise HTTPException(status_code=400, detail=f"Campaign cannot be paused. Status: {campaign.status}")

    campaign.status = "paused"
    campaign.paused_at = datetime.utcnow()
    db.commit()
    return {"message": "Campaign paused successfully.", "status": campaign.status}

@app.post("/api/v1/campaigns/{campaign_id}/resume")
def resume_campaign(campaign_id: UUID, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    campaign = db.query(models.Campaign).filter(
        models.Campaign.id == campaign_id,
        models.Campaign.user_id == current_user.id
    ).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if campaign.status != "paused":
        raise HTTPException(status_code=400, detail=f"Campaign cannot be resumed. Status: {campaign.status}")

    # Set status back to processing
    campaign.status = "processing"
    campaign.paused_at = None
    db.commit()

    # Find which message logs are still pending/queued for this campaign
    pending_logs = db.query(models.MessageLog).filter(
        models.MessageLog.campaign_id == campaign_id,
        models.MessageLog.status == "queued"
    ).all()

    if not pending_logs:
        campaign.status = "completed"
        db.commit()
        return {"message": "Campaign resumed, but all messages were already enqueued/sent.", "status": campaign.status}

    # Fetch all connected devices of the user
    active_devices = db.query(models.Device).filter(
        models.Device.user_id == current_user.id,
        models.Device.status == "connected"
    ).all()

    if not active_devices:
        raise HTTPException(status_code=400, detail="Cannot resume: No connected devices found.")

    # Re-queue existing logs directly to Redis
    device_index = 0
    for log in pending_logs:
        target_device = active_devices[device_index % len(active_devices)]
        log.device_id = target_device.id
        db.commit()

        payload = {
            "message_log_id": str(log.id),
            "campaign_id": str(campaign.id),
            "recipient": log.recipient,
            "message_text": log.message_text,
            "media_url": log.media_url,
            "media_type": log.media_type,
            "min_delay": 5,
            "max_delay": 15
        }
        redis_client.rpush(f"queue:device:{target_device.id}", json.dumps(payload))
        device_index += 1

    return {"message": "Campaign resumed successfully.", "status": campaign.status}

# --- MESSAGE LOGS ---

@app.get("/api/v1/message-logs")
def get_message_logs(
    type: Optional[str] = None,
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.MessageLog).filter(models.MessageLog.user_id == current_user.id)
    if type:
        query = query.filter(models.MessageLog.type == type)
    logs = query.order_by(models.MessageLog.created_at.desc()).limit(limit).all()
    return logs

# --- FILE UPLOAD & AI ASSISTANT ---
import shutil
import uuid

@app.post("/api/v1/upload-media")
def upload_media(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user)
):
    uploads_dir = os.path.join("app", "static", "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Save file with a unique name
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(uploads_dir, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    media_url = f"/static/uploads/{filename}"
    return {"media_url": media_url}

class MessageGenerate(BaseModel):
    prompt: str

@app.post("/api/v1/generate-message")
def generate_message(
    payload: MessageGenerate,
    current_user: models.User = Depends(get_current_user)
):
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "your_openai_key_here":
        raise HTTPException(status_code=400, detail="AI API key is not configured in settings.")
        
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    prompt_text = (
        "Sen kurumsal bir pazarlama ve metin yazarlığı (copywriting) uzmanısın. Türkçe konuş.\n"
        "GÖREV: Kullanıcının belirttiği konuya uygun, yüksek etkileşimli, son derece profesyonel ve ilgi çekici bir WhatsApp toplu mesajı yaz.\n"
        "KURALLAR:\n"
        "1. Bol bol ilgili ve dikkat çekici WhatsApp emojileri (emoji) kullan.\n"
        "2. Metinde başlıkları veya önemli kelimeleri kalın yapmak için WhatsApp kalın formatını (*kalın yazılacak kelime*) kullan.\n"
        "3. Mesajı paragraflara ayır ve okunabilirliği artırmak için liste/bullet point (• veya -) formatları kullan.\n"
        "4. Metinde {İsim} ve {Kod} gibi kişiselleştirme değişkenlerini veya spintax formatını (örn: {Merhaba|Selam}) doğal bir şekilde mutlaka dahil et.\n"
        "5. Cevap olarak SADECE gönderilmeye hazır mesaj metnini döndür. Giriş (örn: 'İşte mesajınız:') veya açıklama ekleme.\n"
        "Konu: " + payload.prompt
    )
    
    groq_payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "user", "content": prompt_text}
        ],
        "temperature": 0.7,
        "max_tokens": 500
    }
    
    try:
        res = requests.post(url, headers=headers, json=groq_payload, timeout=15)
        if res.status_code == 200:
            data = res.json()
            generated = data["choices"][0]["message"]["content"].strip()
            return {"message": generated}
        else:
            raise HTTPException(status_code=res.status_code, detail=f"Groq API Error: {res.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate message with AI: {e}")

# --- STATIC FILES FRONTEND SERVING ---

# Serve Dashboard static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.get("/dashboard")
@app.get("/")
def read_root():
    # Redirect root paths to static dashboard file
    from fastapi.responses import FileResponse
    static_file_path = "app/static/index.html"
    if os.path.exists(static_file_path):
        return FileResponse(static_file_path)
    return {"message": "Frontend static file index.html is missing. Place it in app/static/index.html"}
