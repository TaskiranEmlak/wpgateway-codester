const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL || 'postgresql://wpgateway_user:wpgateway_password@localhost:5432/wpgateway_db';

const pool = new Pool({
  connectionString: databaseUrl,
  // Max number of clients in the pool
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
