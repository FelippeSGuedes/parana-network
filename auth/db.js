const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

const AUTH_DB_HOST = process.env.AUTH_DB_HOST || process.env.DB_HOST || 'localhost';
const AUTH_DB_USER = process.env.AUTH_DB_USER || process.env.DB_USER || 'root';
const AUTH_DB_PASSWORD = process.env.AUTH_DB_PASSWORD || process.env.DB_PASSWORD || '';
const AUTH_DB_NAME = process.env.AUTH_DB_NAME || process.env.DB_NAME || 'authdb';

async function initDB() {
  const pool = mysql.createPool({
    host: AUTH_DB_HOST,
    user: AUTH_DB_USER,
    password: AUTH_DB_PASSWORD,
    database: AUTH_DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  try {
    const [info] = await pool.query('SELECT 1');
    console.log('[AuthDB] connection ok', info ? 'connected' : 'no info');
  } catch (e) {
    console.error('[AuthDB] connection failed:', e && e.message);
    throw e;
  }

  // Ensure schema exists (idempotent)
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    password_algo VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    profile JSON,
    active TINYINT NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  const mapRow = (row) => {
    if (!row) return null;
    const profile = row.profile ? row.profile : null;
    return {
      ...row,
      profile,
      active: row.active != null ? Number(row.active) : row.active,
    };
  };

  async function getUserByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    return mapRow(rows[0]);
  }

  async function getUserById(id) {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
    return mapRow(rows[0]);
  }

  async function getAllUsers() {
    const [rows] = await pool.query('SELECT id, email, username, role, active, created_at, updated_at FROM users ORDER BY created_at DESC');
    return rows.map(mapRow);
  }

  async function deleteUserById(id) {
    try {
      await pool.query('DELETE FROM users WHERE id = ?', [id]);
      return true;
    } catch (e) {
      console.error('[AuthDB][deleteUserById] error', e && e.message);
      return false;
    }
  }

  async function createOrUpdateUser({ id, email, username, password_hash, password_algo, role = 'admin', profile = null, active = 1 }) {
    const existing = await getUserByEmail(email);
    if (existing) {
      const nextActive = active !== undefined ? (active ? 1 : 0) : existing.active;
      await pool.query(
        'UPDATE users SET username = ?, password_hash = ?, password_algo = ?, role = ?, profile = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?',
        [username || existing.username || null, password_hash || existing.password_hash, password_algo || existing.password_algo, role || existing.role, profile ? JSON.stringify(profile) : existing.profile ? JSON.stringify(existing.profile) : null, nextActive, email]
      );
      return getUserByEmail(email);
    }
    await pool.query(
      'INSERT INTO users (id, email, username, password_hash, password_algo, role, profile, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id || uuidv4(), email, username || null, password_hash, password_algo, role, profile ? JSON.stringify(profile) : null, active ? 1 : 0]
    );
    return getUserByEmail(email);
  }

  // keep interface compatible
  const save = () => true;

  return { db: pool, getUserByEmail, getUserById, getAllUsers, createOrUpdateUser, deleteUserById, save, file: 'mysql' };
}

module.exports = { initDB };
