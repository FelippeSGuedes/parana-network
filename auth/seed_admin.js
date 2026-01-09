#!/usr/bin/env node
require('dotenv').config();
const { initDB } = require('./db');
const { v4: uuidv4 } = require('uuid');
let argon2 = null;
try { argon2 = require('argon2'); } catch (e) { argon2 = null; }
const bcrypt = require('bcryptjs');

async function hashPassword(password) {
  if (argon2) {
    try { const h = await argon2.hash(password, { type: argon2.argon2id }); return { algo: 'argon2id', hash: h }; } catch (e) { /* fallthrough */ }
  }
  const h = bcrypt.hashSync(password, 12);
  return { algo: 'bcrypt', hash: h };
}

async function main() {
  const args = process.argv.slice(2);
  const email = args[0] || process.env.ADMIN_EMAIL || 'admin@example.com';
  const username = args[1] || process.env.ADMIN_USERNAME || 'admin';
  const password = args[2] || process.env.ADMIN_PASSWORD || 'ChangeMeNow!2025';
  const role = args[3] || process.env.ADMIN_ROLE || 'admin';

  const db = await initDB();
  const { algo, hash } = await hashPassword(password);
  const id = uuidv4();
  db.createOrUpdateUser({ id, email, username, password_hash: hash, password_algo: algo, role, profile: null, active: 1 });
  console.log(`Admin user created/updated: ${email} (algo=${algo})`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(2); });
