#!/bin/bash

# Ensure directories exist
mkdir -p /app/sessions
mkdir -p /app/backend/app/static/uploads

# Start local Redis in background
echo "[SYSTEM] Starting Redis server..."
redis-server --daemonize yes

# Wait for Redis to be ready
sleep 2

# Set internal networking URLs
export REDIS_URL="redis://127.0.0.1:6379/0"
export WHATSAPP_SERVICE_URL="http://127.0.0.1:3000"

# Start Node.js WhatsApp Service in background
echo "[SYSTEM] Starting WhatsApp Service (Baileys)..."
cd /app/whatsapp-service
npm start &

# Start Celery Worker in background (concurrency=1 to fit Render Free memory)
echo "[SYSTEM] Starting Celery Worker..."
cd /app/backend
celery -A app.tasks.campaign.celery_app worker --loglevel=info --concurrency=1 &

# Start Status Worker in background
echo "[SYSTEM] Starting Status Worker..."
python -m app.tasks.status_worker &

# Start FastAPI main application in foreground (so the container remains active)
echo "[SYSTEM] Starting FastAPI Backend on port 8000..."
uvicorn app.main:app --host 0.0.0.0 --port 8000
