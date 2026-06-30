from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

# --- AUTH SCHEMAS ---
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    credits: int
    api_key: str
    webhook_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- DEVICE SCHEMAS ---
class DeviceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    proxy_url: Optional[str] = None # socks5://user:pass@ip:port or http://...

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    proxy_url: Optional[str] = None
    ai_enabled: Optional[bool] = None
    ai_prompt: Optional[str] = None

class DeviceResponse(BaseModel):
    id: UUID
    name: str
    phone_number: Optional[str] = None
    status: str
    proxy_url: Optional[str] = None
    ai_enabled: bool
    ai_prompt: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- AUTO RESPONDER SCHEMAS ---
class AutoResponderCreate(BaseModel):
    trigger_keyword: str = Field(..., min_length=1, max_length=100)
    reply_text: str = Field(..., min_length=1)
    is_wildcard: bool = True

class AutoResponderResponse(BaseModel):
    id: UUID
    device_id: UUID
    trigger_keyword: str
    reply_text: str
    is_wildcard: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- CAMPAIGN SCHEMAS ---
class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    recipients: List[str] # List of phone numbers
    message_text: str = Field(..., min_length=1)
    media_url: Optional[str] = None
    media_type: Optional[str] = None # image, video, document, audio
    device_ids: List[UUID] # Pool of devices to round-robin
    min_delay: int = Field(5, ge=1)
    max_delay: int = Field(15, ge=1)
    scheduled_for: Optional[datetime] = None

class CampaignResponse(BaseModel):
    id: UUID
    name: str
    status: str
    total_messages: int
    sent_messages: int
    failed_messages: int
    scheduled_for: Optional[datetime] = None
    paused_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- MESSAGE LOG SCHEMAS ---
class OTPMessageSend(BaseModel):
    recipient: str = Field(..., min_length=5, max_length=20)
    message_text: str = Field(..., min_length=1)

class MessageLogResponse(BaseModel):
    id: UUID
    campaign_id: Optional[UUID] = None
    device_id: Optional[UUID] = None
    recipient: str
    message_text: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    type: str
    status: str
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- WEBHOOK CONFIG SCHEMAS ---
class WebhookConfigUpdate(BaseModel):
    webhook_url: str = Field(..., min_length=5)

# --- SAAS BILLING SCHEMAS ---
class CreditAddRequest(BaseModel):
    amount: int = Field(..., gt=0)
