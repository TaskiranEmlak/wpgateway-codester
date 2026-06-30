import time
import json
import logging
from uuid import UUID
from concurrent.futures import ThreadPoolExecutor
import redis
import requests
from app.core.config import settings
from app.core.database import SessionLocal
from app import models

# Configure logger
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("status_worker")

# Redis Client
redis_client = redis.Redis.from_url(settings.REDIS_URL)

# Thread Pool for non-blocking Webhook dispatching
webhook_executor = ThreadPoolExecutor(max_workers=100)

def dispatch_webhook_async(webhook_url: str, payload: dict, log_id_str: str, user_id_str: str):
    """
    Sends webhook callback POST request asynchronously and logs the result.
    """
    def send_request():
        db = SessionLocal()
        try:
            log_id = UUID(log_id_str)
            user_id = UUID(user_id_str)
            
            logger.info(f"Sending webhook to {webhook_url} for message {log_id_str}")
            
            # Create WebhookLog record
            web_log = models.WebhookLog(
                user_id=user_id,
                message_log_id=log_id,
                webhook_url=webhook_url,
                payload=payload,
                status="pending"
            )
            db.add(web_log)
            db.commit()

            start_time = time.time()
            response = requests.post(webhook_url, json=payload, timeout=10)
            elapsed = time.time() - start_time

            web_log.response_status = response.status_code
            web_log.response_body = response.text[:2000] # Cap output text
            web_log.status = "sent" if response.status_code in [200, 201, 202] else "failed"
            db.commit()
            
            logger.info(f"Webhook response: {response.status_code} in {elapsed:.2f}s")

        except Exception as e:
            logger.error(f"Webhook dispatch failed: {e}")
            try:
                web_log.error_message = str(e)
                web_log.status = "failed"
                db.commit()
            except Exception:
                db.rollback()
        finally:
            db.close()

    webhook_executor.submit(send_request)

def redistribute_device_queue(db, device_id):
    """
    Pulls all pending messages from a device's queue and redistributes them round-robin
    to other active connected devices of the same user. If no other active devices exist,
    marks them as failed, pauses the campaigns, and triggers failure webhooks.
    """
    import uuid
    # Ensure device_id is UUID
    if isinstance(device_id, str):
        device_id = uuid.UUID(device_id)

    device = db.query(models.Device).filter(models.Device.id == device_id).first()
    if not device:
        logger.error(f"Device {device_id} not found in DB for failover.")
        return

    queue_key = f"queue:device:{device.id}"
    queue_length = redis_client.llen(queue_key)
    if queue_length == 0:
        logger.info(f"No messages in queue for device {device.id} to redistribute.")
        return

    logger.warning(f"Device {device.id} is offline ({device.status}) but has {queue_length} messages in queue. Redistributing...")

    # Find other active connected devices for the user
    active_devices = db.query(models.Device).filter(
        models.Device.user_id == device.user_id,
        models.Device.status == "connected",
        models.Device.id != device.id
    ).all()

    # Fetch all queued messages from Redis using pipeline (atomic get + delete)
    pipe = redis_client.pipeline()
    pipe.lrange(queue_key, 0, -1)
    pipe.delete(queue_key)
    raw_messages, _ = pipe.execute()
    
    if not raw_messages:
        return

    if active_devices:
        logger.info(f"Redistributing {len(raw_messages)} messages from offline device {device.id} to {len(active_devices)} active devices.")
        
        log_ids_to_update = {} # target_device_id -> list of message UUIDs
        redis_requeues = {} # target_queue -> list of payloads
        
        device_index = 0
        for item in raw_messages:
            try:
                payload = json.loads(item.decode("utf-8"))
            except Exception as pe:
                logger.error(f"Failed to parse payload: {pe}")
                continue
            log_id_str = payload.get("message_log_id")
            if not log_id_str:
                continue
            
            # Pick next active device
            target_device = active_devices[device_index % len(active_devices)]
            target_queue = f"queue:device:{target_device.id}"
            
            # Update payload target device
            payload["device_id"] = str(target_device.id)
            
            if target_device.id not in log_ids_to_update:
                log_ids_to_update[target_device.id] = []
            if target_queue not in redis_requeues:
                redis_requeues[target_queue] = []
            
            log_ids_to_update[target_device.id].append(uuid.UUID(log_id_str))
            redis_requeues[target_queue].append(json.dumps(payload))
            
            device_index += 1

        # Update DB logs in bulk
        for target_device_id, log_ids in log_ids_to_update.items():
            db.query(models.MessageLog).filter(
                models.MessageLog.id.in_(log_ids)
            ).update({"device_id": target_device_id, "error_message": f"Device {device.id} disconnected. Re-routed."}, synchronize_session=False)
        db.commit()

        # Re-enqueue to Redis in bulk using pipeline
        r_pipe = redis_client.pipeline()
        for queue, items in redis_requeues.items():
            r_pipe.rpush(queue, *items)
        r_pipe.execute()

    else:
        # No active devices to failover to! Mark all logs as failed.
        logger.warning(f"No active connected devices found for user {device.user_id}. Marking {len(raw_messages)} queued messages as failed.")
        
        log_ids = []
        campaign_ids = set()
        for item in raw_messages:
            try:
                payload = json.loads(item.decode("utf-8"))
            except Exception as pe:
                logger.error(f"Failed to parse payload: {pe}")
                continue
            log_id_str = payload.get("message_log_id")
            camp_id_str = payload.get("campaign_id")
            if log_id_str:
                log_ids.append(uuid.UUID(log_id_str))
            if camp_id_str:
                campaign_ids.add(uuid.UUID(camp_id_str))

        # Update DB logs as failed
        if log_ids:
            db.query(models.MessageLog).filter(
                models.MessageLog.id.in_(log_ids)
            ).update({
                "status": "failed", 
                "error_message": f"Connection lost on device {device.id} and no other connected devices found for failover."
            }, synchronize_session=False)
            db.commit()

            # Trigger Webhook Callbacks for these failed messages
            user = db.query(models.User).filter(models.User.id == device.user_id).first()
            if user and user.webhook_url:
                for log_id in log_ids:
                    message_log = db.query(models.MessageLog).filter(models.MessageLog.id == log_id).first()
                    if message_log:
                        webhook_payload = {
                            "event": "message_status",
                            "message_id": str(message_log.id),
                            "recipient": message_log.recipient,
                            "status": "failed",
                            "type": message_log.type,
                            "error_message": message_log.error_message,
                            "timestamp": time.time()
                        }
                        dispatch_webhook_async(user.webhook_url, webhook_payload, str(message_log.id), str(user.id))

        # Update campaign statuses to paused and update campaigns failed counts
        for camp_id in campaign_ids:
            failed_count_for_camp = db.query(models.MessageLog).filter(
                models.MessageLog.campaign_id == camp_id,
                models.MessageLog.id.in_(log_ids),
                models.MessageLog.status == "failed"
            ).count()
            
            campaign = db.query(models.Campaign).filter(models.Campaign.id == camp_id).first()
            if campaign:
                campaign.status = "paused"
                campaign.failed_messages += failed_count_for_camp
                db.commit()

def process_status_update(db, update: dict):
    """
    Processes a single message status update, executing database changes and failover logic.
    """
    msg_log_id_str = update.get("message_log_id")
    status = update.get("status")
    device_id_str = update.get("device_id")
    error_message = update.get("error_message")
    should_failover = update.get("should_failover", False)
    campaign_id_str = update.get("campaign_id")

    # --- DEVICE LEVEL FAILOVER EVENT ---
    # If should_failover is true, and we have a device_id, but no specific message_log_id,
    # it means the device disconnected or banned, and we need to redistribute its whole queue immediately.
    if should_failover and device_id_str and not msg_log_id_str:
        logger.info(f"Received instant device-level failover trigger for device {device_id_str}")
        try:
            redistribute_device_queue(db, device_id_str)
        except Exception as e:
            logger.error(f"Failed to redistribute queue for device {device_id_str}: {e}")
        return

    if not msg_log_id_str:
        return

    msg_log_id = UUID(msg_log_id_str)
    
    # Fetch message log
    message_log = db.query(models.MessageLog).filter(models.MessageLog.id == msg_log_id).first()
    if not message_log:
        logger.error(f"Message log {msg_log_id_str} not found.")
        return

    user = db.query(models.User).filter(models.User.id == message_log.user_id).first()
    campaign = None
    if message_log.campaign_id:
        campaign = db.query(models.Campaign).filter(models.Campaign.id == message_log.campaign_id).first()

    old_status = message_log.status

    # --- FAILOVER LOGIC ---
    if should_failover and campaign:
        logger.info(f"Device {device_id_str} failed to send message {msg_log_id_str}. Initiating failover...")
        
        # 1. Update the failed device status to 'disconnected' in DB
        if device_id_str:
            db.query(models.Device).filter(models.Device.id == UUID(device_id_str)).update({"status": "disconnected"})
            db.commit()

        # 2. Look for another active (connected) device belonging to the user
        alternative_device = db.query(models.Device).filter(
            models.Device.user_id == message_log.user_id,
            models.Device.status == "connected",
            models.Device.id != UUID(device_id_str) if device_id_str else True
        ).first()

        if alternative_device:
            logger.info(f"Failing over to device {alternative_device.id} (name: {alternative_device.name})")
            
            # Re-queue the message under the new device
            message_log.device_id = alternative_device.id
            message_log.status = "queued"
            message_log.retry_count += 1
            message_log.error_message = f"Failed on device {device_id_str}. Re-routed."
            db.commit()

            # Enqueue back into Redis for the new device
            payload = {
                "message_log_id": str(message_log.id),
                "campaign_id": str(campaign.id),
                "recipient": message_log.recipient,
                "message_text": message_log.message_text,
                "media_url": message_log.media_url,
                "media_type": message_log.media_type,
                # Default delay ranges
                "min_delay": 5,
                "max_delay": 15
            }
            redis_client.rpush(f"queue:device:{alternative_device.id}", json.dumps(payload))
            return # Skip webhook/campaign increments as it is re-queued

        else:
            logger.warn(f"No alternative connected devices found for user {message_log.user_id}. Message marked as failed.")
            message_log.status = "failed"
            message_log.error_message = f"Connection failed on device {device_id_str} and no other connected devices found for failover."
            db.commit()
            status = "failed"

    # --- REGULAR STATUS UPDATE ---
    else:
        message_log.status = status
        if device_id_str:
            message_log.device_id = UUID(device_id_str)
        if error_message:
            message_log.error_message = error_message
        db.commit()

    # Update Campaign Stats if this is a campaign message
    if campaign and old_status != status:
        if status == "sent":
            campaign.sent_messages += 1
        elif status == "failed":
            campaign.failed_messages += 1
        
        # Check if Campaign is complete
        total_processed = campaign.sent_messages + campaign.failed_messages
        if total_processed >= campaign.total_messages:
            campaign.status = "completed"
            logger.info(f"Campaign {campaign.id} marked as completed.")
        db.commit()

    # Trigger Webhook Callback
    if user and user.webhook_url:
        webhook_payload = {
            "event": "message_status",
            "message_id": str(message_log.id),
            "recipient": message_log.recipient,
            "status": status,
            "type": message_log.type,
            "error_message": message_log.error_message,
            "timestamp": time.time()
        }
        dispatch_webhook_async(user.webhook_url, webhook_payload, str(message_log.id), str(user.id))

def run_periodic_health_check():
    """
    Runs in a background thread every 10 seconds.
    Checks for disconnected/banned devices and redistributes any pending messages in their queues.
    """
    logger.info("Starting periodic database health check thread...")
    while True:
        try:
            time.sleep(10)
            db = SessionLocal()
            try:
                # Fetch all devices that are not connected
                dead_devices = db.query(models.Device).filter(models.Device.status != "connected").all()
                for device in dead_devices:
                    redistribute_device_queue(db, device.id)
            except Exception as inner_e:
                logger.error(f"Error in health check db block: {inner_e}")
                db.rollback()
            finally:
                db.close()
        except Exception as outer_e:
            logger.error(f"Error in periodic health check thread: {outer_e}")

def main_loop():
    logger.info("WhatsApp Status Updates Worker is running...")
    
    # Start background health check and queue failover thread
    import threading
    t = threading.Thread(target=run_periodic_health_check, daemon=True)
    t.start()
    
    while True:
        try:
            # BLPOP with 2-second timeout
            result = redis_client.blpop("queue:status_updates", timeout=2)
            if not result:
                continue

            _, element = result
            update = json.loads(element.decode("utf-8"))

            db = SessionLocal()
            try:
                process_status_update(db, update)
            except Exception as e:
                logger.error(f"Error processing status update: {e}")
                db.rollback()
            finally:
                db.close()

        except Exception as e:
            logger.error(f"Status worker loop error: {e}")
            time.sleep(2)

if __name__ == "__main__":
    main_loop()
