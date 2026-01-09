require('dotenv').config();
const mysql = require('mysql2/promise');

const host = process.env.AUTH_DB_HOST || process.env.DB_HOST || 'localhost';
const user = process.env.AUTH_DB_USER || process.env.DB_USER || 'root';
const password = process.env.AUTH_DB_PASSWORD || process.env.DB_PASSWORD || '';
const database = process.env.AUTH_DB_NAME || process.env.DB_NAME || 'authdb';

(async () => {
  console.log('[test-mysql] trying to connect with:');
  console.log({ host, user, database });
  try {
    const pool = mysql.createPool({ host, user, password, database, waitForConnections: true, connectionLimit: 2 });
    const [rows] = await pool.query('SELECT 1 AS ok, VERSION() AS version');
    console.log('[test-mysql] success:', rows[0]);
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('[test-mysql] connection failed:', e && e.message);
    if (e && e.code) console.error('code:', e.code);
    if (e && e.errno) console.error('errno:', e.errno);
    process.exit(1);
  }
})();
