import json
import logging
from uuid import UUID
import redis
from celery import Celery
from app.core.config import settings
from app.core.database import SessionLocal
from app import models

logger = logging.getLogger(__name__)

# Initialize Celery
celery_app = Celery("tasks", broker=settings.REDIS_URL, backend=settings.REDIS_URL)

# Redis client
redis_client = redis.Redis.from_url(settings.REDIS_URL)

@celery_app.task(name="tasks.send_campaign_task")
def send_campaign_task(
    campaign_id_str: str,
    device_id_strs: list,
    min_delay: int,
    max_delay: int,
    recipients: list,
    message_text: str,
    media_url: str = None,
    media_type: str = None
):
    db = SessionLocal()
    try:
        campaign_id = UUID(campaign_id_str)
        campaign = db.query(models.Campaign).filter(models.Campaign.id == campaign_id).first()
        if not campaign:
            logger.error(f"Campaign {campaign_id_str} not found in database.")
            return

        user = db.query(models.User).filter(models.User.id == campaign.user_id).first()
        if not user:
            logger.error(f"User for campaign {campaign_id_str} not found.")
            campaign.status = "failed"
            db.commit()
            return

        campaign.status = "processing"
        db.commit()

        # Parse UUIDs
        device_ids = [UUID(d_str) for d_str in device_id_strs]

        # Fetch active devices in pool
        active_devices = db.query(models.Device).filter(
            models.Device.id.in_(device_ids),
            models.Device.status == "connected"
        ).all()

        if not active_devices:
            logger.error(f"No connected devices found in pool for campaign {campaign_id_str}.")
            campaign.status = "failed"
            db.commit()
            return

        active_device_ids = [device.id for device in active_devices]
        device_count = len(active_device_ids)
        
        logger.info(f"Distributing {len(recipients)} messages to {device_count} connected devices.")

        import uuid

        device_index = 0
        enqueued_count = 0
        batch_size = 5000
        logs_to_insert = []
        redis_payloads = {} # queue_name -> list of payloads
        user_credits = user.credits

        # Initialize active_devices for the loop
        active_devices = db.query(models.Device).filter(
            models.Device.id.in_(device_ids),
            models.Device.status == "connected"
        ).all()

        for recipient in recipients:
            # To avoid huge database overhead, refresh campaign status and active devices every 1000 items
            if enqueued_count % 1000 == 0:
                db.refresh(campaign)
                if campaign.status in ["paused", "failed"]:
                    logger.info(f"Campaign {campaign_id_str} is in '{campaign.status}' state. Stopping enqueue.")
                    break

                active_devices = db.query(models.Device).filter(
                    models.Device.id.in_(device_ids),
                    models.Device.status == "connected"
                ).all()

            # 1. Credit Check
            if user_credits <= 0:
                logger.warning(f"User {user.username} out of credits. Pausing campaign {campaign_id_str}.")
                campaign.status = "paused"
                break

            # 2. Pick next device in pool via Round Robin
            if not active_devices:
                logger.error("All devices in the pool have disconnected. Pausing campaign.")
                campaign.status = "paused"
                break

            active_device_ids = [device.id for device in active_devices]
            target_device_id = active_device_ids[device_index % len(active_device_ids)]

            # 3. Create message log with client-side generated UUID
            log_id = uuid.uuid4()
            message_log = models.MessageLog(
                id=log_id,
                user_id=user.id,
                campaign_id=campaign.id,
                device_id=target_device_id,
                recipient=recipient,
                message_text=message_text,
                media_url=media_url,
                media_type=media_type,
                type="marketing",
                status="queued"
            )
            logs_to_insert.append(message_log)

            # 4. Deduct credit locally
            user_credits -= 1

            # 5. Prepare task payload
            payload = {
                "message_log_id": str(log_id),
                "campaign_id": str(campaign.id),
                "recipient": recipient,
                "message_text": message_text,
                "media_url": media_url,
                "media_type": media_type,
                "min_delay": min_delay,
                "max_delay": max_delay
            }
            
            queue_name = f"queue:device:{target_device_id}"
            if queue_name not in redis_payloads:
                redis_payloads[queue_name] = []
            redis_payloads[queue_name].append(json.dumps(payload))
            
            device_index += 1
            enqueued_count += 1

            # Batch processing to optimize DB and Redis network throughput
            if len(logs_to_insert) >= batch_size:
                db.bulk_save_objects(logs_to_insert)
                db.commit()
                logs_to_insert.clear()

                # Redis pipeline batch push
                pipe = redis_client.pipeline()
                for queue, items in redis_payloads.items():
                    pipe.rpush(queue, *items)
                pipe.execute()
                redis_payloads.clear()

        # Save remaining logs
        if logs_to_insert:
            db.bulk_save_objects(logs_to_insert)
            logs_to_insert.clear()

        # Update final campaign total and user credits
        user.credits = user_credits
        campaign.total_messages = enqueued_count
        db.commit()

        # Push remaining Redis payloads
        if redis_payloads:
            pipe = redis_client.pipeline()
            for queue, items in redis_payloads.items():
                pipe.rpush(queue, *items)
            pipe.execute()
            redis_payloads.clear()

        logger.info(f"Enqueued {enqueued_count} messages for campaign {campaign_id_str}.")

    except Exception as e:
        logger.exception(f"Error executing campaign {campaign_id_str}: {e}")
        db.rollback()
    finally:
        db.close()
