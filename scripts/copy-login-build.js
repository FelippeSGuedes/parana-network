const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'Login', 'dist');
const DST = path.resolve(__dirname, '..', 'public', 'Login');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return false;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  return true;
}

try {
  if (!fs.existsSync(SRC)) {
    console.warn('[copy-login-build] Nenhum build encontrado em', SRC);
    process.exit(0);
  }
  copyRecursive(SRC, DST);
  console.log('[copy-login-build] Copiado Login/dist -> public/Login');
} catch (e) {
  console.error('[copy-login-build] Erro ao copiar:', e && e.message);
  process.exit(1);
}
