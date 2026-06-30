const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379/0';

const client = createClient({
  url: redisUrl,
});

client.on('error', (err) => {
  console.error('Redis client error:', err);
});

client.on('connect', () => {
  console.log('Connected to Redis');
});

// Immediately invoke async connection
(async () => {
  try {
    await client.connect();
  } catch (error) {
    console.error('Failed to connect to Redis during startup:', error);
  }
})();

module.exports = {
  client,
};
