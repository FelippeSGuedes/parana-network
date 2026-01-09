const { spawn } = require('child_process');
const path = require('path');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
    p.on('error', reject);
    p.on('exit', (code, signal) => {
      if (signal) return reject(new Error(`Process terminated by signal ${signal}`));
      resolve(code);
    });
  });
}

(async () => {
  try {
    const root = path.join(__dirname, '..');
    const seeder = path.join(root, 'auth', 'seed_admin.js');
    console.log('[seed-and-start] Running seeder:', seeder);
    const code = await run(process.execPath, [seeder]);
    if (code !== 0) {
      console.error('[seed-and-start] Seeder exited with code', code);
      process.exit(code);
    }
    console.log('[seed-and-start] Seeder finished. Starting server...');
    const server = path.join(root, 'server.js');
    // spawn server and keep the current process attached to it (forward stdio)
    const child = spawn(process.execPath, [server], { stdio: 'inherit' });
    child.on('exit', (c, s) => {
      if (s) console.warn('[seed-and-start] server terminated by signal', s);
      process.exit(c === null ? 0 : c);
    });
  } catch (err) {
    console.error('[seed-and-start] error', err && err.stack || err);
    process.exit(2);
  }
})();
