-- Database Schema for Enterprise WhatsApp Gateway & Marketing Suite

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    credits INT DEFAULT 1000 NOT NULL,
    webhook_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Index for authentication and key validation
CREATE INDEX IF NOT EXISTS idx_users_api_key ON users(api_key);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 2. Devices Table (WhatsApp Instances)
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    status VARCHAR(50) DEFAULT 'disconnected' NOT NULL, -- 'disconnected', 'connecting', 'connected', 'banned'
    proxy_url VARCHAR(255), -- HTTP or SOCKS5 proxy (e.g. socks5://user:pass@ip:port)
    ai_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    ai_prompt TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);

-- 3. Campaigns Table (Bulk Marketing)
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- 'pending', 'processing', 'paused', 'completed', 'failed'
    total_messages INT DEFAULT 0 NOT NULL,
    sent_messages INT DEFAULT 0 NOT NULL,
    failed_messages INT DEFAULT 0 NOT NULL,
    scheduled_for TIMESTAMP, -- Nullable (runs immediately if null)
    paused_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- 4. Message Logs Table (Tracking all sent/received messages)
CREATE TABLE IF NOT EXISTS message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    recipient VARCHAR(30) NOT NULL, -- Receiver phone number
    message_text TEXT NOT NULL,
    media_url TEXT,
    media_type VARCHAR(50), -- 'image', 'video', 'document', 'audio'
    type VARCHAR(30) NOT NULL, -- 'otp', 'marketing'
    status VARCHAR(50) DEFAULT 'queued' NOT NULL, -- 'queued', 'sending', 'sent', 'delivered', 'read', 'failed'
    retry_count INT DEFAULT 0 NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_logs_user_id ON message_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_campaign_id ON message_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_device_id ON message_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);
CREATE INDEX IF NOT EXISTS idx_message_logs_recipient ON message_logs(recipient);

-- 5. Webhook Logs Table (For client callbacks)
CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_log_id UUID NOT NULL REFERENCES message_logs(id) ON DELETE CASCADE,
    webhook_url TEXT NOT NULL,
    payload JSONB NOT NULL,
    response_status INT,
    response_body TEXT,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL, -- 'pending', 'sent', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_user_id ON webhook_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_status ON webhook_logs(status);

-- 6. Auto Responders Table (Simple keyword mapping)
CREATE TABLE IF NOT EXISTS auto_responders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    trigger_keyword VARCHAR(100) NOT NULL,
    reply_text TEXT NOT NULL,
    is_wildcard BOOLEAN DEFAULT TRUE NOT NULL, -- True: contains keyword, False: exact match
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_device_keyword UNIQUE (device_id, trigger_keyword)
);

CREATE INDEX IF NOT EXISTS idx_auto_responders_device_id ON auto_responders(device_id);
