const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'restaurante_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
  process.exit(-1);
});

/**
 * Ejecuta una consulta SQL
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<import('pg').QueryResult>}
 */
const query = async (text, params) => {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 Query ejecutada', { text: text.substring(0, 80), duration: `${duration}ms`, rows: result.rowCount });
  }
  return result;
};

/**
 * Obtiene un cliente del pool para transacciones
 * @returns {Promise<import('pg').PoolClient>}
 */
const getClient = async () => {
  return await pool.connect();
};

module.exports = { pool, query, getClient };
