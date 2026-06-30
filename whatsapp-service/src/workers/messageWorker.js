const { delay } = require('@whiskeysockets/baileys');
const path = require('path');
const { client: redisClient } = require('../config/redis');
const db = require('../config/db');

// Map to keep track of active worker loops per device (to avoid duplicate loops)
const deviceWorkersRunning = {};

/**
 * Parses spintax: e.g. "{Merhaba|Selam} {İsim}" -> "Merhaba İsim" or "Selam İsim"
 */
function parseSpintax(text) {
  if (!text) return '';
  const spintaxPattern = /\{([^{}]*\|[^{}]*)\}/g;
  let matches;
  while ((matches = spintaxPattern.exec(text)) !== null) {
    const options = matches[1].split('|');
    const randomOption = options[Math.floor(Math.random() * options.length)];
    text = text.replace(matches[0], randomOption);
    spintaxPattern.lastIndex = 0; // Reset index to re-scan from start
  }
  return text;
}

/**
 * Format phone number to JID: e.g. "905551234567" -> "905551234567@s.whatsapp.net"
 */
function formatToJid(number) {
  if (typeof number !== 'string') return '';
  number = number.trim();
  if (number.endsWith('@s.whatsapp.net') || number.endsWith('@g.us')) {
    return number;
  }
  let cleaned = number.replace(/\D/g, '');
  return `${cleaned}@s.whatsapp.net`;
}

/**
 * Helper to push status updates to Redis queue for Python status worker consumption
 */
async function pushStatusUpdate(statusData) {
  try {
    const payload = JSON.stringify({
      ...statusData,
      timestamp: new Date().toISOString()
    });
    // Push to Redis status update list
    await redisClient.rPush('queue:status_updates', payload);
  } catch (error) {
    console.error('Error pushing status update to Redis:', error);
  }
}

/**
 * Sends a WhatsApp message (text or media) using Baileys
 */
async function sendWhatsAppMessage(sock, recipientJid, messageText, mediaUrl, mediaType) {
  let content = {};
  if (mediaUrl) {
    let adjustedMediaUrl = mediaUrl;
    if (mediaUrl.includes('localhost:8000')) {
      adjustedMediaUrl = mediaUrl.replace('localhost:8000', 'backend:8000');
      console.log(`Worker: Rewrote media URL for Docker compatibility: ${mediaUrl} -> ${adjustedMediaUrl}`);
    } else if (mediaUrl.includes('127.0.0.1:8000')) {
      adjustedMediaUrl = mediaUrl.replace('127.0.0.1:8000', 'backend:8000');
      console.log(`Worker: Rewrote media URL for Docker compatibility: ${mediaUrl} -> ${adjustedMediaUrl}`);
    }

    if (mediaType === 'image') {
      content = { image: { url: adjustedMediaUrl }, caption: messageText };
    } else if (mediaType === 'video') {
      content = { video: { url: adjustedMediaUrl }, caption: messageText };
    } else if (mediaType === 'document') {
      const fileName = path.basename(adjustedMediaUrl) || 'document.pdf';
      content = { document: { url: adjustedMediaUrl }, mimetype: 'application/pdf', fileName: fileName, caption: messageText };
    } else if (mediaType === 'audio') {
      content = { audio: { url: adjustedMediaUrl }, mimetype: 'audio/mp4', ptt: true };
    } else {
      content = { text: messageText };
    }
  } else {
    content = { text: messageText };
  }
  return sock.sendMessage(recipientJid, content);
}

/**
 * Dedicated worker loop for a specific WhatsApp device
 * Processes marketing campaigns at independent rates (X to Y seconds delay)
 */
async function startDeviceWorker(deviceId) {
  // Prevent starting duplicate worker loops
  if (deviceWorkersRunning[deviceId]) {
    console.log(`Worker loop already running for device: ${deviceId}`);
    return;
  }

  deviceWorkersRunning[deviceId] = true;
  console.log(`Starting worker loop for device: ${deviceId}`);

  const { activeSessions, activeWorkers } = require('../services/sessionManager');
  const queueKey = `queue:device:${deviceId}`;

  while (activeWorkers[deviceId]) {
    const sock = activeSessions[deviceId];
    
    // If socket is not connected, stop this loop (let sessionManager restart it when connected)
    if (!sock || !sock.isConnected) {
      console.log(`Worker for device ${deviceId} paused: socket not connected.`);
      deviceWorkersRunning[deviceId] = false;
      break;
    }

    try {
      // BLPOP with multiple keys: queue:otp_high_priority takes absolute priority over device marketing queue
      const result = await redisClient.blPop(['queue:otp_high_priority', queueKey], 2);
      if (!result) continue; // Timeout, check loop condition and try again

      const isOtp = result.key === 'queue:otp_high_priority';
      const taskData = JSON.parse(result.element);
      console.log(`Processing ${isOtp ? 'high-priority OTP' : 'marketing'} task for device ${deviceId}, messageId: ${taskData.message_log_id}`);

      const recipientJid = formatToJid(taskData.recipient);
      
      // Spintax & Personalization
      let finalizedText = parseSpintax(taskData.message_text);
      if (taskData.variables) {
        // Simple variable replacement: e.g. {İsim} -> Ahmet
        Object.entries(taskData.variables).forEach(([key, val]) => {
          finalizedText = finalizedText.replace(new RegExp(`{${key}}`, 'g'), val);
        });
      }

      // Typing simulation (1s for OTP, 2-6s based on text length for marketing)
      const typingTime = isOtp ? 1000 : Math.min(6000, Math.max(2000, finalizedText.length * 20));
      await sock.sendPresenceUpdate('composing', recipientJid);
      await delay(typingTime);
      await sock.sendPresenceUpdate('paused', recipientJid);

      // Send message
      try {
        await sendWhatsAppMessage(sock, recipientJid, finalizedText, taskData.media_url, taskData.media_type);
        console.log(`Sent message successfully: ${taskData.message_log_id}`);

        // Push successful status update
        await pushStatusUpdate({
          message_log_id: taskData.message_log_id,
          status: 'sent',
          device_id: deviceId
        });
      } catch (sendError) {
        console.error(`Failed to send message: ${taskData.message_log_id}`, sendError);

        // Check if connection died during send
        const isConnDead = !sock || !sock.isConnected;
        
        await pushStatusUpdate({
          message_log_id: taskData.message_log_id,
          status: isConnDead ? 'queued' : 'failed', // If connection died, queue it back
          device_id: deviceId,
          error_message: sendError.message,
          should_failover: isConnDead, // Tell python to redistribute if device died
          campaign_id: taskData.campaign_id
        });

        if (isConnDead) {
          console.log(`Connection died on device ${deviceId} during send. Triggering reconnect...`);
          deviceWorkersRunning[deviceId] = false;
          break;
        }
      }

      // Bypass anti-ban random delay for OTP messages to ensure instant SMS-like speed
      if (!isOtp) {
        const minDelay = taskData.min_delay || 5;
        const maxDelay = taskData.max_delay || 15;
        const randomDelayMs = Math.floor(Math.random() * (maxDelay - minDelay + 1) + minDelay) * 1000;
        
        console.log(`Device ${deviceId} sleeping for ${randomDelayMs / 1000}s before next send...`);
        await delay(randomDelayMs);
      } else {
        console.log(`Device ${deviceId} processed OTP task immediately without anti-ban delay.`);
      }

    } catch (error) {
      console.error(`Error in device worker loop for ${deviceId}:`, error);
      await delay(5000); // Sleep on error to prevent CPU thrashing
    }
  }

  deviceWorkersRunning[deviceId] = false;
  console.log(`Worker loop stopped for device: ${deviceId}`);
}

/**
 * Global OTP Worker
 * Pulls from queue:otp and dispatches immediately using ANY connected device
 */
async function startGlobalOtpWorker() {
  console.log('Starting global OTP Worker...');
  const { activeSessions } = require('../services/sessionManager');

  while (true) {
    try {
      // BLPOP from queue:otp_high_priority with a 5-second timeout
      const result = await redisClient.blPop('queue:otp_high_priority', 5);
      if (!result) continue;

      const taskData = JSON.parse(result.element);
      console.log(`Processing high-priority OTP task: ${taskData.message_log_id}`);

      // Find any active, connected session
      const connectedDevices = Object.entries(activeSessions).filter(([_, sock]) => sock && sock.isConnected);
      
      if (connectedDevices.length === 0) {
        console.warn('No active connected WhatsApp devices available for OTP dispatch. Re-queueing in 1s...');
        
        // Re-queue task and wait a bit
        await redisClient.lPush('queue:otp_high_priority', JSON.stringify(taskData));
        await delay(1000);
        continue;
      }

      // Simple load balancing (Round Robin/First available)
      const [deviceId, sock] = connectedDevices[Math.floor(Math.random() * connectedDevices.length)];
      const recipientJid = formatToJid(taskData.recipient);

      // Send OTP (very short typing simulation, 1s)
      await sock.sendPresenceUpdate('composing', recipientJid);
      await delay(1000);
      await sock.sendPresenceUpdate('paused', recipientJid);

      try {
        await sendWhatsAppMessage(sock, recipientJid, taskData.message_text, null, null);
        console.log(`OTP sent successfully via device ${deviceId}: ${taskData.message_log_id}`);

        await pushStatusUpdate({
          message_log_id: taskData.message_log_id,
          status: 'sent',
          device_id: deviceId
        });
      } catch (sendError) {
        console.error(`Failed to send OTP via device ${deviceId}:`, sendError);
        
        // Re-queue OTP immediately to let another device try
        await redisClient.lPush('queue:otp_high_priority', JSON.stringify(taskData));
        
        // Record intermediate failure log
        await pushStatusUpdate({
          message_log_id: taskData.message_log_id,
          status: 'queued',
          error_message: `Attempt failed on device ${deviceId}: ${sendError.message}`
        });
        
        await delay(500);
      }

    } catch (error) {
      console.error('Error in global OTP worker:', error);
      await delay(2000);
    }
  }
}

// Start the global OTP worker immediately on module load (Disabled - prioritized queue polling implemented in device workers instead to prevent concurrent write bans)
// startGlobalOtpWorker();

module.exports = {
  startDeviceWorker,
  startGlobalOtpWorker
};
