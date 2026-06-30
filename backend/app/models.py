import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, JSON, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(150), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    api_key = Column(String(255), unique=True, nullable=False, index=True)
    credits = Column(Integer, default=1000, nullable=False)
    webhook_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    devices = relationship("Device", back_populates="user", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="user", cascade="all, delete-orphan")
    message_logs = relationship("MessageLog", back_populates="user", cascade="all, delete-orphan")
    webhook_logs = relationship("WebhookLog", back_populates="user", cascade="all, delete-orphan")

class Device(Base):
    __tablename__ = "devices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    phone_number = Column(String(20), nullable=True)
    status = Column(String(50), default="disconnected", nullable=False, index=True) # disconnected, connecting, connected, banned
    proxy_url = Column(String(255), nullable=True)
    ai_enabled = Column(Boolean, default=False, nullable=False)
    ai_prompt = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="devices")
    auto_responders = relationship("AutoResponder", back_populates="device", cascade="all, delete-orphan")
    message_logs = relationship("MessageLog", back_populates="device")

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    status = Column(String(50), default="pending", nullable=False, index=True) # pending, processing, paused, completed, failed
    total_messages = Column(Integer, default=0, nullable=False)
    sent_messages = Column(Integer, default=0, nullable=False)
    failed_messages = Column(Integer, default=0, nullable=False)
    scheduled_for = Column(DateTime, nullable=True)
    paused_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="campaigns")
    message_logs = relationship("MessageLog", back_populates="campaign", cascade="all, delete-orphan")

class MessageLog(Base):
    __tablename__ = "message_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=True)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="SET NULL"), nullable=True)
    recipient = Column(String(30), nullable=False, index=True)
    message_text = Column(Text, nullable=False)
    media_url = Column(Text, nullable=True)
    media_type = Column(String(50), nullable=True) # image, video, document, audio
    type = Column(String(30), nullable=False) # otp, marketing
    status = Column(String(50), default="queued", nullable=False, index=True) # queued, sending, sent, delivered, read, failed
    retry_count = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="message_logs")
    campaign = relationship("Campaign", back_populates="message_logs")
    device = relationship("Device", back_populates="message_logs")
    webhook_logs = relationship("WebhookLog", back_populates="message_log", cascade="all, delete-orphan")

class WebhookLog(Base):
    __tablename__ = "webhook_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message_log_id = Column(UUID(as_uuid=True), ForeignKey("message_logs.id", ondelete="CASCADE"), nullable=False)
    webhook_url = Column(Text, nullable=False)
    payload = Column(JSON, nullable=False)
    response_status = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    status = Column(String(50), default="pending", nullable=False, index=True) # pending, sent, failed
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="webhook_logs")
    message_log = relationship("MessageLog", back_populates="webhook_logs")

class AutoResponder(Base):
    __tablename__ = "auto_responders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    device_id = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    trigger_keyword = Column(String(100), nullable=False)
    reply_text = Column(Text, nullable=False)
    is_wildcard = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    device = relationship("Device", back_populates="auto_responders")
