const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { OpenAI } = require('openai');
const db = require('../config/db');

// Logger configurations
const logger = pino({ level: 'silent' });

// In-memory state
const activeSessions = {}; // deviceId -> socket
const activeQrs = {};      // deviceId -> base64QrCode
const activeWorkers = {};  // deviceId -> boolean (to control worker loop)

// AI Client & Model Configuration (Supports OpenAI and Groq)
let openai;
let aiModel = 'gpt-3.5-turbo';
const apiKey = process.env.OPENAI_API_KEY;

if (apiKey && apiKey !== 'your_openai_key_here') {
  if (apiKey.startsWith('gsk_')) {
    openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.groq.com/openai/v1'
    });
    aiModel = 'llama-3.3-70b-versatile';
    console.log('Using Groq API with model:', aiModel);
  } else {
    openai = new OpenAI({ apiKey: apiKey });
    aiModel = 'gpt-3.5-turbo';
    console.log('Using OpenAI API with model:', aiModel);
  }
}

/**
 * Helper to build Proxy Agent based on URL
 */
function getProxyAgent(proxyUrl) {
  if (!proxyUrl) return undefined;
  try {
    if (proxyUrl.startsWith('socks')) {
      return new SocksProxyAgent(proxyUrl);
    } else if (proxyUrl.startsWith('http')) {
      return new HttpsProxyAgent(proxyUrl);
    }
  } catch (error) {
    console.error(`Error parsing proxy URL: ${proxyUrl}`, error);
  }
  return undefined;
}

/**
 * Initialize a WhatsApp session for a device
 */
async function initSession(deviceId, phoneNumber = null) {
  if (activeSessions[deviceId]) {
    if (phoneNumber) {
      console.log(`Session already active for device: ${deviceId}, but phone number provided for pairing. Re-initializing...`);
      const oldSock = activeSessions[deviceId];
      try { oldSock.end(); } catch (e) {}
      delete activeSessions[deviceId];
      delete activeQrs[deviceId];
    } else {
      console.log(`Session already active for device: ${deviceId}`);
      return { sock: activeSessions[deviceId], pairingCode: null };
    }
  }

  console.log(`Initializing WhatsApp session for device: ${deviceId}`);

  // Fetch device details from PostgreSQL (for proxy, AI settings)
  const deviceRes = await db.query('SELECT * FROM devices WHERE id = $1', [deviceId]);
  if (deviceRes.rows.length === 0) {
    throw new Error(`Device not found: ${deviceId}`);
  }
  const device = deviceRes.rows[0];
  const proxyUrl = device.proxy_url;

  // Session dir path (survives container restart via docker volume)
  const sessionDir = path.join('/app', 'sessions', deviceId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  // Setup multi-file auth state
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  // Setup proxy agent if defined
  const agent = getProxyAgent(proxyUrl);

  // Fetch latest WhatsApp Web version to avoid 405 Connection Failure
  let version = [2, 3000, 1017595462]; // Modern fallback version
  try {
    const { version: latestVersion, isLatest } = await fetchLatestBaileysVersion();
    version = latestVersion;
    console.log(`Using Baileys version: ${version.join('.')}, isLatest: ${isLatest}`);
  } catch (err) {
    console.warn('Failed to fetch latest Baileys version, using fallback:', err);
  }

  // Create socket connection
  const sock = makeWASocket({
    auth: state,
    logger: logger,
    version: version,
    printQRInTerminal: false,
    agent: agent,
    browser: ['Antigravity Gateway', 'Chrome', '1.0.0'],
    defaultQueryTimeoutMs: 60000,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  activeSessions[deviceId] = sock;

  let pairingCode = null;
  if (phoneNumber && !state.creds.registered) {
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    try {
      await delay(2000);
      pairingCode = await sock.requestPairingCode(cleanedPhone);
      console.log(`Pairing code generated for device ${deviceId}: ${pairingCode}`);
    } catch (e) {
      console.error(`Failed to request pairing code for device ${deviceId}:`, e);
    }
  }

  // QR timeout - restart if not scanned within 60 seconds
  let qrTimeout = null;
  let qrCount = 0;

  // Listen to connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`QR Code generated for device: ${deviceId}`);
      try {
        const qrBase64 = await QRCode.toDataURL(qr);
        activeQrs[deviceId] = qrBase64;
        await db.query('UPDATE devices SET status = $1, updated_at = NOW() WHERE id = $2', ['connecting', deviceId]);

        qrCount++;
        console.log(`QR code #${qrCount} generated for device: ${deviceId}`);
        
        // Reset QR timeout
        if (qrTimeout) clearTimeout(qrTimeout);
        qrTimeout = setTimeout(async () => {
          console.log(`QR code timeout for device: ${deviceId}. No scan detected after 60s.`);
          try { sock.end(); } catch (e) {}
          delete activeSessions[deviceId];
          delete activeQrs[deviceId];
          // Retry after a short delay
          setTimeout(() => initSession(deviceId), 3000);
        }, 60000);
      } catch (err) {
        console.error('Error generating QR base64:', err);
      }
    }

    if (connection === 'close') {
      sock.isConnected = false;
      if (qrTimeout) { clearTimeout(qrTimeout); qrTimeout = null; }
      
      if (activeSessions[deviceId] !== sock) {
        console.log(`Socket for device ${deviceId} is stale or replaced. Skipping close event actions.`);
        return;
      }
      
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`Connection closed for device: ${deviceId}. Reconnect: ${shouldReconnect}. Error:`, lastDisconnect?.error);

      // Clear QR code in memory
      delete activeQrs[deviceId];

      if (!shouldReconnect) {
        // Logged out / Banned
        console.log(`Device ${deviceId} logged out or banned.`);
        await db.query('UPDATE devices SET status = $1, updated_at = NOW() WHERE id = $2', ['banned', deviceId]);
        
        // Instant failover trigger to redistribute remaining Redis queue items
        try {
          const { client: redisClient } = require('../config/redis');
          await redisClient.rPush('queue:status_updates', JSON.stringify({
            device_id: deviceId,
            should_failover: true
          }));
        } catch (re) {
          console.error('Failed to queue failover trigger for banned device:', re);
        }

        // Clean up session directory & state
        delete activeSessions[deviceId];
        activeWorkers[deviceId] = false; // Stop the worker loop
        
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (e) {
          console.error(`Failed to delete session directory for device: ${deviceId}`, e);
        }
      } else {
        // Network disconnect, reconnecting
        await db.query('UPDATE devices SET status = $1, updated_at = NOW() WHERE id = $2', ['disconnected', deviceId]);
        delete activeSessions[deviceId];

        // Instant failover trigger to redistribute remaining Redis queue items
        try {
          const { client: redisClient } = require('../config/redis');
          await redisClient.rPush('queue:status_updates', JSON.stringify({
            device_id: deviceId,
            should_failover: true
          }));
        } catch (re) {
          console.error('Failed to queue failover trigger for disconnected device:', re);
        }

        // Wait and retry
        setTimeout(() => initSession(deviceId), 5000);
      }
    }

    if (connection === 'open') {
      sock.isConnected = true;
      if (qrTimeout) { clearTimeout(qrTimeout); qrTimeout = null; }
      console.log(`WhatsApp connection established successfully for device: ${deviceId}`);
      
      const rawJid = sock.user.id;
      const phoneNumber = rawJid.split(':')[0];

      // Update device in DB
      await db.query(
        'UPDATE devices SET status = $1, phone_number = $2, updated_at = NOW() WHERE id = $3',
        ['connected', phoneNumber, deviceId]
      );

      // Clean QR state
      delete activeQrs[deviceId];

      // Start worker loop for this device
      const { startDeviceWorker } = require('../workers/messageWorker');
      activeWorkers[deviceId] = true;
      startDeviceWorker(deviceId);
    }
  });

  // Listen to credentials change and save
  sock.ev.on('creds.update', saveCreds);

  // Listen to incoming messages (Auto-Responder & OpenAI Chatbot)
  sock.ev.on('messages.upsert', async (m) => {
    const { messages, type } = m;
    if (type !== 'notify') return;

    for (const msg of messages) {
      // Ignore messages sent by ourselves or system/groups (unless user enables AI in groups, but default is direct)
      if (msg.key.fromMe) continue;
      const senderJid = msg.key.remoteJid;
      if (!senderJid) continue;

      // Extract raw incoming text
      const incomingText = msg.message?.conversation || 
                           msg.message?.extendedTextMessage?.text || 
                           msg.message?.buttonsResponseMessage?.selectedButtonId || 
                           msg.message?.listResponseMessage?.title || '';

      if (!incomingText) continue;

      // 1. Process Auto-Responders
      const responderMatched = await handleAutoResponder(deviceId, senderJid, incomingText, sock);
      if (responderMatched) continue;

      // 2. Process OpenAI AI Agent (if enabled)
      await handleAiAgent(deviceId, senderJid, incomingText, sock);
    }
  });

  return { sock, pairingCode };
}

/**
 * Handle Auto Responders
 */
async function handleAutoResponder(deviceId, senderJid, incomingText, sock) {
  try {
    // Fetch active responders for device
    const respondersRes = await db.query(
      'SELECT * FROM auto_responders WHERE device_id = $1',
      [deviceId]
    );

    for (const responder of respondersRes.rows) {
      const keyword = responder.trigger_keyword.toLowerCase().trim();
      const textToTest = incomingText.toLowerCase().trim();
      let matched = false;

      if (responder.is_wildcard) {
        matched = textToTest.includes(keyword);
      } else {
        matched = textToTest === keyword;
      }

      if (matched) {
        console.log(`Auto-responder matched [${responder.trigger_keyword}] for sender [${senderJid}]`);
        
        // Simulating presence update
        await sock.sendPresenceUpdate('composing', senderJid);
        await delay(2000); // 2 seconds typing simulation
        await sock.sendPresenceUpdate('paused', senderJid);

        // Send reply
        await sock.sendMessage(senderJid, { text: responder.reply_text });
        return true;
      }
    }
  } catch (error) {
    console.error('Error in handleAutoResponder:', error);
  }
  return false;
}

/**
 * Handle AI Agent (OpenAI/ChatGPT)
 */
async function handleAiAgent(deviceId, senderJid, incomingText, sock) {
  try {
    // Check if AI is enabled for this device
    const deviceRes = await db.query(
      'SELECT ai_enabled, ai_prompt FROM devices WHERE id = $1',
      [deviceId]
    );

    if (deviceRes.rows.length === 0) return;
    const device = deviceRes.rows[0];

    if (!device.ai_enabled) return;
    if (!openai) {
      console.warn('AI Chatbot enabled but OpenAI client not initialized (check your API key)');
      return;
    }

    const systemPrompt = device.ai_prompt || 'Sen yardımsever bir müşteri temsilcisisin.';
    console.log(`Routing message to AI Agent for device ${deviceId}, sender: ${senderJid}`);

    // Dynamic typing presence while calling OpenAI
    await sock.sendPresenceUpdate('composing', senderJid);

    const completion = await openai.chat.completions.create({
      model: aiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: incomingText },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    
    // Pause composing presence
    await sock.sendPresenceUpdate('paused', senderJid);

    if (reply) {
      await sock.sendMessage(senderJid, { text: reply });
    }
  } catch (error) {
    console.error('Error in handleAiAgent:', error);
  }
}

/**
 * Stop WhatsApp Session for a device
 */
async function stopSession(deviceId) {
  console.log(`Stopping session for device: ${deviceId}`);
  activeWorkers[deviceId] = false; // Terminate worker loops
  
  const sock = activeSessions[deviceId];
  if (sock) {
    try {
      await sock.logout();
    } catch (e) {
      // If logout fails, just close connection
      try { sock.end(); } catch (err) {}
    }
    delete activeSessions[deviceId];
  }

  delete activeQrs[deviceId];
  await db.query('UPDATE devices SET status = $1, updated_at = NOW() WHERE id = $2', ['disconnected', deviceId]);
}

/**
 * Initialize all connected devices from DB on startup
 */
async function initAllConnectedSessions() {
  try {
    console.log('Initializing all connected devices from database...');
    const res = await db.query("SELECT id FROM devices WHERE status IN ('connected', 'connecting', 'disconnected')");
    for (const row of res.rows) {
      try {
        await initSession(row.id);
      } catch (e) {
        console.error(`Failed to initialize session for device ${row.id}:`, e);
      }
    }
  } catch (error) {
    console.error('Failed to init connected sessions on startup:', error);
  }
}

module.exports = {
  initSession,
  stopSession,
  activeSessions,
  activeQrs,
  activeWorkers,
  initAllConnectedSessions,
};
