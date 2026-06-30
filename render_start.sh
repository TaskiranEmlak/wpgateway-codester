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

# Start Node.js WhatsApp Service in background (force port 3000 to avoid conflicting with Render's public PORT)
echo "[SYSTEM] Starting WhatsApp Service (Baileys)..."
cd /app/whatsapp-service
PORT=3000 npm start &

# Start Celery Worker in background (concurrency=1 to fit Render Free memory)
echo "[SYSTEM] Starting Celery Worker..."
cd /app/backend
celery -A app.tasks.campaign.celery_app worker --loglevel=info --concurrency=1 &

# Start Status Worker in background
echo "[SYSTEM] Starting Status Worker..."
python -m app.tasks.status_worker &

# Start FastAPI main application in foreground (binding to Render's public PORT, which defaults to 10000 or 8000 fallback)
echo "[SYSTEM] Starting FastAPI Backend on port ${PORT:-8000}..."
uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
