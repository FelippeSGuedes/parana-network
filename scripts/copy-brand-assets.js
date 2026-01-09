// scripts/copy-brand-assets.js
// Copia o ícone de marca para a pasta public antes de start/build

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'Login', 'Imgs', 'icon.png');
const DST = path.resolve(__dirname, '..', 'public', 'zabbmap-icon.png');

function ensureDir(p) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyIcon() {
  try {
    if (!fs.existsSync(SRC)) {
      console.warn(`[copy-brand-assets] Arquivo de origem não encontrado: ${SRC}`);
      console.warn('[copy-brand-assets] O favicon continuará sendo o padrão até o arquivo existir.');
      return;
    }
    ensureDir(DST);
    fs.copyFileSync(SRC, DST);
    console.log(`[copy-brand-assets] Copiado: ${SRC} -> ${DST}`);
  } catch (e) {
    console.error('[copy-brand-assets] Falha copiando ícone:', e.message);
  }
}

copyIcon();
