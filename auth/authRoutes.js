const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Try to load argon2 if available, otherwise fallback to bcryptjs
let argon2 = null;
try { argon2 = require('argon2'); } catch (e) { argon2 = null; }
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'please-change-this-secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '2h';
const ALLOW_SELF_REGISTER = process.env.ALLOW_SELF_REGISTER === '1';
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase();
const AUTH_DEBUG = process.env.AUTH_DEBUG === '1';

function authDebug(req, msg, extra) {
  if (!AUTH_DEBUG) return;
  try {
    const xfProto = String((req.headers && (req.headers['x-forwarded-proto'] || req.headers['X-Forwarded-Proto'])) || '').toLowerCase();
    const host = req.headers && req.headers.host;
    const origin = req.headers && req.headers.origin;
    const referer = req.headers && req.headers.referer;
    console.log('[Auth][debug]', msg, {
      host,
      origin,
      referer,
      secure: !!req.secure,
      xfProto,
      hasCookieHeader: !!(req.headers && req.headers.cookie),
      cookieLen: req.headers && req.headers.cookie ? String(req.headers.cookie).length : 0,
      ...extra,
    });
  } catch (e) {
    // ignore
  }
}

async function verifyPassword(storedAlgo, storedHash, candidate) {
  if (storedAlgo && storedAlgo.toLowerCase().startsWith('argon2') && argon2) {
    try { return await argon2.verify(storedHash, candidate); } catch (e) { return false; }
  }
  if (storedAlgo && storedAlgo.toLowerCase().startsWith('bcrypt')) {
    return bcrypt.compareSync(candidate, storedHash);
  }
  // Try common heuristics: if hash looks like $argon2, use argon2 if available
  if (String(storedHash || '').startsWith('$argon2') && argon2) {
    try { return await argon2.verify(storedHash, candidate); } catch (e) { return false; }
  }
  // fallback to bcryptjs
  return bcrypt.compareSync(candidate, storedHash);
}

async function hashPasswordPreferArgon2(password) {
  if (argon2) {
    try {
      const h = await argon2.hash(password, { type: argon2.argon2id });
      return { algo: 'argon2id', hash: h };
    } catch (e) {
      // fallthrough to bcrypt
    }
  }
  const h = bcrypt.hashSync(password, 12);
  return { algo: 'bcrypt', hash: h };
}

module.exports = function createAuthRouter(db) {
  const router = express.Router();

  // helper: read token from Authorization header or cookie
  function extractToken(req) {
    // 1) Prefer cookie-parser
    if (req && req.cookies && req.cookies.auth_token) {
      return String(req.cookies.auth_token);
    }
    const ah = req.headers && req.headers.authorization;
    if (ah && ah.toLowerCase().startsWith('bearer ')) return ah.split(' ')[1];
    const cookie = req.headers && req.headers.cookie;
    if (cookie) {
      const m = cookie.split(/;\s*/).map(s => s.split('='));
      for (const [k, v] of m) {
        if (k !== 'auth_token') continue;
        const raw = v || '';
        try {
          return decodeURIComponent(raw);
        } catch (e) {
          // If it's not URI-encoded (normal JWT), just return raw
          return String(raw);
        }
      }
    }
    return null;
  }

  // verify token and return user object or null (async)
  async function verifyTokenAndUser(req) {
    const token = extractToken(req);
    if (!token) {
      authDebug(req, 'missing auth_token', {});
      return null;
    }
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const uid = payload && payload.sub;
      if (!uid) return null;
      const user = await db.getUserById(uid);
      if (!user) return null;
      if (!user.active || Number(user.active) === 0) return null;
      return { payload, user };
    } catch (e) {
      authDebug(req, 'invalid token', { err: e && e.name ? e.name : 'error' });
      return null;
    }
  }

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password required' });
      console.log(`[Auth][login] attempt for email=${String(email).slice(0,80)}`);
      const user = await db.getUserByEmail(email);
      if (!user) return res.status(401).json({ ok: false, error: 'invalid credentials' });
      if (!user.active || Number(user.active) === 0) return res.status(403).json({ ok: false, error: 'user not active' });

      // Promote designated super-admin email to role super_admin (idempotent)
      if (SUPER_ADMIN_EMAIL && String(user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL && user.role !== 'super_admin') {
        try {
          await db.createOrUpdateUser({ id: user.id, email: user.email, username: user.username, password_hash: user.password_hash, password_algo: user.password_algo, role: 'super_admin', active: user.active });
          user.role = 'super_admin';
        } catch (e) {
          // non-fatal
        }
      }
      const ok = await verifyPassword(user.password_algo, user.password_hash, password);
      if (!ok) return res.status(401).json({ ok: false, error: 'invalid credentials' });

      // Lazy re-hash to argon2 if available and current algo isn't argon2
      if (argon2 && !(user.password_algo || '').toLowerCase().startsWith('argon2')) {
        try {
          const { algo, hash } = await hashPasswordPreferArgon2(password);
          db.createOrUpdateUser({ id: user.id, email: user.email, username: user.username, password_hash: hash, password_algo: algo, role: user.role, profile: user.profile && JSON.parse(user.profile) });
        } catch (e) { /* non-fatal */ }
      }

      const payload = { sub: user.id, email: user.email, role: user.role };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
      // set cookie HttpOnly so subsequent requests (including page loads) include it
      try {
        const xfProto = String((req.headers && (req.headers['x-forwarded-proto'] || req.headers['X-Forwarded-Proto'])) || '').toLowerCase();
        const isHttps = req.secure || xfProto === 'https';
        // Para túnel/HTTPS: SameSite=None + Secure evita bloqueios de cookie em alguns cenários.
        // Para HTTP local: mantém Lax sem Secure.
        res.cookie('auth_token', token, {
          httpOnly: true,
          path: '/',
          sameSite: isHttps ? 'none' : 'lax',
          secure: isHttps,
        });
        console.log('[Auth][login] cookie set auth_token (HttpOnly) for', user.email);
      } catch (e) {
        console.warn('[Auth][login] falha ao setar cookie:', e && e.message);
      }
      console.log(`[Auth][login] success for email=${user.email} id=${user.id}`);
      res.json({ ok: true, token, user: { id: user.id, email: user.email, username: user.username, role: user.role } });
    } catch (err) {
      console.error('Auth /login error', err && err.message);
      res.status(500).json({ ok: false, error: 'internal' });
    }
  });

  // Logout: clear auth cookie
  router.post('/logout', (req, res) => {
    try {
      res.clearCookie('auth_token');
    } catch (e) {
      // ignore
    }
    return res.json({ ok: true });
  });

  // Self-registration disabled by default (set ALLOW_SELF_REGISTER=1 to enable)
  router.post('/register', async (req, res) => {
    if (!ALLOW_SELF_REGISTER) return res.status(403).json({ ok: false, error: 'registration disabled' });
    try {
      const { email, password, username } = req.body || {};
      if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password required' });
      const existing = await db.getUserByEmail(email);
      if (existing) return res.status(409).json({ ok: false, error: 'email already registered' });
      const { algo, hash } = await hashPasswordPreferArgon2(password);
      const user = await db.createOrUpdateUser({ email, username: username || null, password_hash: hash, password_algo: algo, role: 'user', active: 1 });
      return res.json({ ok: true, user: { id: user.id, email: user.email, username: user.username, role: user.role, active: user.active } });
    } catch (err) {
      console.error('Auth /register error', err && err.message);
      res.status(500).json({ ok: false, error: 'internal' });
    }
  });

  // token validation middleware factory (API-friendly: returns JSON 401/403)
  function createAuthMiddleware() {
    return async (req, res, next) => {
      try {
        const info = await verifyTokenAndUser(req);
        if (!info) {
          authDebug(req, 'auth middleware denied', {});
          return res.status(401).json({ ok: false, error: 'missing or invalid token' });
        }
        req.user = { id: info.user.id, email: info.user.email, username: info.user.username, role: info.user.role };
        next();
      } catch (err) {
        console.error('[Auth][middleware] error', err && err.message);
        res.status(500).json({ ok: false, error: 'internal' });
      }
    };
  }

  // redirecting middleware for browser navigation: redirect to /Login when not authenticated
  function createAuthMiddlewareRedirect() {
    return async (req, res, next) => {
      try {
        const info = await verifyTokenAndUser(req);
        if (!info) {
          const nextUrl = encodeURIComponent(req.originalUrl || '/');
          return res.redirect(`/Login/?next=${nextUrl}`);
        }
        req.user = { id: info.user.id, email: info.user.email, username: info.user.username, role: info.user.role };
        next();
      } catch (err) {
        console.error('[Auth][redirect-middleware] error', err && err.message);
        res.redirect('/Login/');
      }
    };
  }

  // expose helpers to create middleware from outside
  router.createAuthMiddleware = createAuthMiddleware;
  router.createAuthMiddlewareRedirect = createAuthMiddlewareRedirect;

  // expose /me for clients to verify current user (API style)
  router.get('/me', createAuthMiddleware(), (req, res) => {
    res.json({ ok: true, user: req.user });
  });

  // admin-only middleware
  function adminOnly(req, res, next) {
    (async () => {
      try {
        const info = await verifyTokenAndUser(req);
        if (!info) return res.status(401).json({ ok: false, error: 'missing or invalid token' });
        const role = info.user && info.user.role;
        if (role !== 'admin' && role !== 'super_admin') return res.status(403).json({ ok: false, error: 'admin required' });
        req.user = { id: info.user.id, email: info.user.email, username: info.user.username, role: role };
        next();
      } catch (e) {
        console.error('[Auth][adminOnly] error', e && e.message);
        res.status(500).json({ ok: false, error: 'internal' });
      }
    })();
  }

  // Admin: list users
  router.get('/admin/users', adminOnly, async (req, res) => {
    try {
      const list = await db.getAllUsers();
      res.json({ ok: true, users: list });
    } catch (e) {
      console.error('[Auth][admin/users] error', e && e.message);
      res.status(500).json({ ok: false, error: 'internal' });
    }
  });

  // Admin: create user
  router.post('/admin/users', adminOnly, async (req, res) => {
    try {
      const { email, username, password, role = 'user', active = 1 } = req.body || {};
      if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password required' });
      const allowedRoles = ['user', 'admin', 'super_admin'];
      if (!allowedRoles.includes(role)) return res.status(400).json({ ok: false, error: 'invalid role' });
      const { algo, hash } = await hashPasswordPreferArgon2(password);
      const user = await db.createOrUpdateUser({ id: uuidv4(), email, username, password_hash: hash, password_algo: algo, role, profile: null, active: active ? 1 : 0 });
      res.json({ ok: true, user });
    } catch (e) {
      console.error('[Auth][admin/createUser] error', e && e.message);
      res.status(500).json({ ok: false, error: 'internal' });
    }
  });

  // Admin: update user (role/active/username/password)
  router.put('/admin/users/:id', adminOnly, async (req, res) => {
    try {
      const userId = req.params.id;
      const { email, username, password, role, active } = req.body || {};
      const existing = await db.getUserById(userId);
      if (!existing) return res.status(404).json({ ok: false, error: 'user not found' });

      let password_hash = existing.password_hash;
      let password_algo = existing.password_algo;
      if (password) {
        const hashed = await hashPasswordPreferArgon2(password);
        password_hash = hashed.hash;
        password_algo = hashed.algo;
      }

      let nextRole = existing.role;
      if (role) {
        const allowedRoles = ['user', 'admin', 'super_admin'];
        if (!allowedRoles.includes(role)) return res.status(400).json({ ok: false, error: 'invalid role' });
        nextRole = role;
      }

      const updated = await db.createOrUpdateUser({
        id: existing.id,
        email: email || existing.email,
        username: username !== undefined ? username : existing.username,
        password_hash,
        password_algo,
        role: nextRole,
        profile: existing.profile || null,
        active: active !== undefined ? (active ? 1 : 0) : existing.active,
      });
      res.json({ ok: true, user: updated });
    } catch (e) {
      console.error('[Auth][admin/updateUser] error', e && e.message);
      res.status(500).json({ ok: false, error: 'internal' });
    }
  });

  // Admin: update user (partial)
  router.put('/admin/users/:id', adminOnly, async (req, res) => {
    try {
      const id = req.params.id;
      const existing = db.getUserById(id);
      if (!existing) return res.status(404).json({ ok: false, error: 'not found' });
      const { email, username, password, role, active } = req.body || {};
      let password_hash = existing.password_hash;
      let password_algo = existing.password_algo;
      if (password) {
        const h = await hashPasswordPreferArgon2(password);
        password_hash = h.hash; password_algo = h.algo;
      }
      const updated = db.createOrUpdateUser({ id: existing.id, email: email || existing.email, username: username || existing.username, password_hash, password_algo, role: role || existing.role, profile: existing.profile && JSON.parse(existing.profile), active: active !== undefined ? (active ? 1 : 0) : existing.active });
      res.json({ ok: true, user: updated });
    } catch (e) {
      console.error('[Auth][admin/updateUser] error', e && e.message);
      res.status(500).json({ ok: false, error: 'internal' });
    }
  });

  // Admin: delete user
  router.delete('/admin/users/:id', adminOnly, (req, res) => {
    try {
      const id = req.params.id;
      const ok = db.deleteUserById(id);
      if (!ok) return res.status(500).json({ ok: false, error: 'delete failed' });
      res.json({ ok: true });
    } catch (e) {
      console.error('[Auth][admin/deleteUser] error', e && e.message);
      res.status(500).json({ ok: false, error: 'internal' });
    }
  });

  return router;
};
