global.crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { initSession, stopSession, activeQrs, activeSessions, initAllConnectedSessions } = require('./services/sessionManager');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Endpoint to start a session (generate QR or reconnect)
app.post('/sessions/:id/start', async (req, res) => {
  const deviceId = req.params.id;
  try {
    await initSession(deviceId);
    res.status(200).json({ message: 'Session initialization triggered.', device_id: deviceId });
  } catch (error) {
    console.error(`Error starting session ${deviceId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to start a session and return pairing code
app.post('/sessions/:id/pair', async (req, res) => {
  const deviceId = req.params.id;
  const { phone_number } = req.body;
  if (!phone_number) {
    return res.status(400).json({ error: 'phone_number is required' });
  }
  try {
    const { pairingCode } = await initSession(deviceId, phone_number);
    res.status(200).json({ pairing_code: pairingCode, device_id: deviceId });
  } catch (error) {
    console.error(`Error pairing session ${deviceId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to stop a session (logout and close socket)
app.post('/sessions/:id/stop', async (req, res) => {
  const deviceId = req.params.id;
  try {
    await stopSession(deviceId);
    res.status(200).json({ message: 'Session stopped successfully.', device_id: deviceId });
  } catch (error) {
    console.error(`Error stopping session ${deviceId}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to poll QR code
app.get('/sessions/:id/qr', (req, res) => {
  const deviceId = req.params.id;
  const qr = activeQrs[deviceId] || null;
  res.status(200).json({ qr });
});

// Endpoint to get session status
app.get('/sessions/:id/status', (req, res) => {
  const deviceId = req.params.id;
  const sock = activeSessions[deviceId];
  
  let status = 'disconnected';
  if (sock) {
    if (sock.isConnected) {
      status = 'connected';
    } else {
      status = 'connecting';
    }
  }

  res.status(200).json({ device_id: deviceId, status });
});

// Start Express API server
app.listen(port, '0.0.0.0', async () => {
  console.log(`WhatsApp Microservice API listening on port ${port}`);
  
  // Re-establish saved connections from database on start
  await initAllConnectedSessions();
});
