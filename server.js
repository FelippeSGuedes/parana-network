require('dotenv').config();
const express = require("express");
const path = require('path');
const cors = require("cors");
const cookieParser = require('cookie-parser');
const mysql = require("mysql2/promise");
const https = require("https");
const { exec } = require("child_process");
// Node 18+ já possui fetch nativo; nenhuma dependência externa necessária.

function env(name, fallback, { required = false } = {}) {
  const val = process.env[name];
  if (val !== undefined && val !== "") return val;
  if (required) throw new Error(`Missing required env ${name}`);
  return fallback;
}

const DB_CONFIG = {
  host: env("DB_HOST", undefined, { required: true }),
  user: env("DB_USER", undefined, { required: true }),
  password: env("DB_PASSWORD", undefined, { required: true }),
  database: env("DB_NAME", "glpi"),
};

const PORT = process.env.PORT_API || process.env.PORT || 4000;
const BUILD_TAG = new Date().toISOString();

// Configs de resiliência
const DB_MAX_RETRIES = 3;
const DB_RETRY_DELAY_MS = 500; // backoff linear simples
const ZABBIX_MAX_RETRIES = Number(process.env.ZABBIX_MAX_RETRIES) || 3; // além das variações de username/user
const ZABBIX_TIMEOUT_MS = Number(process.env.ZABBIX_TIMEOUT_MS) || 20000; // tempo de espera por chamada ao Zabbix

// Configurações Zabbix via variáveis de ambiente (fallback provisório)
const ZABBIX_URL = env("ZABBIX_URL", undefined, { required: true });
const ZABBIX_USER = env("ZABBIX_USER", undefined, { required: true });
const ZABBIX_PASSWORD = env("ZABBIX_PASSWORD", undefined, { required: true });
// Template ID para filtrar itens icmpping
const ZABBIX_TEMPLATE_ID = env("ZABBIX_TEMPLATE_ID", "10564");
const ZABBIX_INSECURE = (process.env.ZABBIX_INSECURE || '').toLowerCase() === 'true' || process.env.ZABBIX_INSECURE === '1';
// Regra de priorização de status: 'icmp_only' (padrão) ou 'agent_or_icmp'
// Por solicitação: considerar estritamente o ICMP ping (Up (1) => online, Down (0) => offline)
const ZABBIX_STATUS_RULE = (process.env.ZABBIX_STATUS_RULE || 'icmp_only').toLowerCase();
// Coleta de métricas adicionais de qualidade de link
// Variáveis de ambiente suportadas:
//   ZABBIX_FETCH_SIGNAL=1 (desativa se "0")
//   ZABBIX_RSSI_KEYS="net.if.avgRssi,avgRssi,rssi" (lista de chaves preferenciais)
//   ZABBIX_LQI_KEYS="net.if.avgLqi,avgLqi,lqi" (lista de chaves preferenciais)
//   ZABBIX_AVAIL_KEYS="icmp.success.24h" (lista de chaves para disponibilidade agregada)
const ZABBIX_FETCH_SIGNAL = (process.env.ZABBIX_FETCH_SIGNAL || '1') !== '0';
const ZABBIX_RSSI_KEYS = (process.env.ZABBIX_RSSI_KEYS || 'net.if.avgRssi,avgRssi,rssi')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const ZABBIX_LQI_KEYS = (process.env.ZABBIX_LQI_KEYS || 'net.if.avgLqi,avgLqi,lqi')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const ZABBIX_AVAIL_KEYS = (process.env.ZABBIX_AVAIL_KEYS || 'icmp.success.24h')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const zabbixHttpsAgent = ZABBIX_INSECURE ? new https.Agent({ rejectUnauthorized: false }) : undefined;

let zabbixAuthToken = null;
let lastAuthTs = 0;
const AUTH_TTL_MS = 1000 * 60 * 25; // renovar a cada 25 min

// Descoberta dinâmica da coluna "ID Próximo Equipamento" no GLPI
let PROXIMO_COL = undefined; // string | null (null = não existe, undefined = ainda não detectado)
async function detectProximoColumn() {
  if (PROXIMO_COL !== undefined) return PROXIMO_COL; // já detectado nesta execução
  try {
    // Override via variável de ambiente, se fornecida
    const envCol = (process.env.GLPI_PROXIMO_COL || '').trim();
    if (envCol) {
      PROXIMO_COL = envCol;
      console.log(`[GLPI][detect] Coluna definida por variável de ambiente GLPI_PROXIMO_COL='${PROXIMO_COL}'`);
      return PROXIMO_COL;
    }
    const [cols] = await queryWithRetry('SHOW COLUMNS FROM glpi_plugin_fields_peripheraldispositivos');
    const names = (cols || []).map(c => (c.Field || c.COLUMN_NAME || '').toString().toLowerCase());
    // Preferências conhecidas por convenção
    const preferred = [
      // Nome reportado pelo usuário (digitação específica sem o 'o' após 'pr')
      'idprximoequipamentofield',
      // Variantes comuns
      'idproximoequipamentofield',
      'idproximoequipamento',
      'id_proximo_equipamento',
      'idproximequipamentofield',
      'proximoequipamentofield',
    ];
    let found = null;
    for (const p of preferred) {
      const hit = names.find(n => n === p);
      if (hit) { found = hit; break; }
    }
    if (!found) {
      // Heurística: algo que contenha "proximo" e "equip" ao mesmo tempo
      found = names.find(n => n.includes('proximo') && n.includes('equip')) || null;
    }
    PROXIMO_COL = found || null;
    if (PROXIMO_COL) {
      console.log(`[GLPI][detect] Coluna de ID Próximo Equipamento encontrada: ${PROXIMO_COL}`);
    } else {
      console.warn('[GLPI][detect] Coluna de ID Próximo Equipamento não encontrada; seguiremos com NULL no SELECT.');
    }
  } catch (e) {
    PROXIMO_COL = null;
    console.warn('[GLPI][detect] Falha ao consultar colunas; usando NULL para idProximoEquipamento:', e.message);
  }
  return PROXIMO_COL;
}

// Descoberta dinâmica da coluna "ID B2B" no GLPI (evita depender de um nome fixo/typo)
let B2B_COL = undefined; // string | null (null = não existe, undefined = ainda não detectado)
async function detectB2bColumn() {
  if (B2B_COL !== undefined) return B2B_COL;
  try {
    // Override via variável de ambiente, se fornecida
    const envCol = (process.env.GLPI_B2B_COL || '').trim();
    if (envCol) {
      B2B_COL = envCol;
      console.log(`[GLPI][detect] Coluna B2B definida por variável de ambiente GLPI_B2B_COL='${B2B_COL}'`);
      return B2B_COL;
    }
    const [cols] = await queryWithRetry('SHOW COLUMNS FROM glpi_plugin_fields_peripheraldispositivos');
    const names = (cols || []).map(c => (c.Field || c.COLUMN_NAME || '').toString().toLowerCase());
    const preferred = [
      'idb2bfield',
      'idb2b',
      'id_b2b',
      'b2bfield',
      // possíveis digitações/typos que vimos:
      'idbtwobfield', // "btwo" no lugar de "b2"
    ];
    let found = null;
    for (const p of preferred) {
      const hit = names.find(n => n === p);
      if (hit) { found = hit; break; }
    }
    if (!found) {
      // Heurística: qualquer coluna que contenha 'b2b'
      found = names.find(n => n.includes('b2b')) || null;
    }
    B2B_COL = found || null;
    if (B2B_COL) {
      console.log(`[GLPI][detect] Coluna de ID B2B encontrada: ${B2B_COL}`);
    } else {
      console.warn('[GLPI][detect] Coluna de ID B2B não encontrada; seguiremos com NULL no SELECT.');
    }
  } catch (e) {
    B2B_COL = null;
    console.warn('[GLPI][detect] Falha ao consultar colunas; usando NULL para idB2b:', e.message);
  }
  return B2B_COL;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function zabbixRequest(body, { retries = ZABBIX_MAX_RETRIES, timeoutMs = ZABBIX_TIMEOUT_MS } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const methodName = body && body.method ? String(body.method) : 'unknown';
      const resp = await fetch(`${ZABBIX_URL}/api_jsonrpc.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json-rpc",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        agent: zabbixHttpsAgent,
      });
      clearTimeout(t);
      if (!resp.ok) {
        throw new Error(`Zabbix HTTP ${resp.status} (method=${methodName})`);
      }
      const data = await resp.json();
      if (data.error) {
        throw new Error(`Zabbix error: ${JSON.stringify(data.error)} (method=${methodName})`);
      }
      return data.result;
    } catch (err) {
      lastErr = err;
      const isAbort = err && (err.name === 'AbortError');
      const msg = isAbort ? `timeout after ${timeoutMs}ms` : (err && err.message) || String(err);
      console.warn(`[Zabbix][request][attempt ${attempt+1}/${retries+1}] ${msg}`);
      if (attempt < retries) {
        // backoff exponencial leve com jitter
        const base = 300 * (attempt + 1);
        const jitter = Math.floor(Math.random() * 200);
        await sleep(base + jitter);
      }
    }
  }
  throw lastErr;
// fim da função zabbixRequest
}

// Normaliza nomes (remove acentos, padroniza hífens e caixa, remove separadores extras)
function normalizeName(raw) {
  if (!raw) return '';
  return String(raw)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-') // vários hífens unicode -> '-'
    .toLowerCase()
    .trim()
    .replace(/\s*[-_\s]+\s*/g, '-') // qualquer separador/whitespace -> '-'
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Autentica no Zabbix com cache de token
async function ensureZabbixAuth() {
  const now = Date.now();
  if (zabbixAuthToken && (now - lastAuthTs) < AUTH_TTL_MS) {
    return zabbixAuthToken;
  }
  const candidates = Array.from(new Set([
    ZABBIX_USER,
    (ZABBIX_USER || '').toLowerCase(),
    'Admin',
    'admin',
  ].filter(Boolean)));

  let lastErr;
    for (const username of candidates) {
    try {
      // Zabbix 6.x usa 'username' ao invés de 'user' (5.x aceitava 'user')
      let result;
      try {
        // Zabbix 6.x e acima
        result = await zabbixRequest({
          jsonrpc: '2.0',
          method: 'user.login',
          params: { username, password: ZABBIX_PASSWORD },
          id: 1,
        });
      } catch (e1) {
        // fallback legacy Zabbix 5.x: aceita 'user'
        result = await zabbixRequest({
          jsonrpc: '2.0',
          method: 'user.login',
          params: { user: username, password: ZABBIX_PASSWORD },
          id: 1,
        });
      }
      if (result) {
        zabbixAuthToken = result;
        lastAuthTs = Date.now();
        return zabbixAuthToken;
      }
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Falha ao autenticar no Zabbix');
}

// Busca hosts e itens icmpping, retornando mapas de status e nomes e disponibilidade (icmp.success.24h)
async function fetchIcmpStatusWithHosts() {
  try {
    const auth = await ensureZabbixAuth();
    // 1) Hosts vinculados ao template (quando informado)
    const hostParams = {
      output: ['hostid', 'name', 'available'], // available: 0=unknown,1=available,2=unavailable
      filter: { status: 0 }, // ativos
    };
    if (ZABBIX_TEMPLATE_ID) {
      hostParams.templateids = [String(ZABBIX_TEMPLATE_ID)];
    }
    const hosts = await zabbixRequest({
      jsonrpc: '2.0',
      method: 'host.get',
      params: hostParams,
      id: 2,
      auth,
    });

    const hostIds = hosts.map(h => h.hostid);
    if (!hostIds.length) return { statusById: {}, hostNameById: {}, statusByNormalizedName: {}, items: [] };

    // 2) Itens icmpping desses hosts
    const items = await zabbixRequest({
      jsonrpc: '2.0',
      method: 'item.get',
      params: {
        output: ['itemid', 'hostid', 'lastvalue', 'key_'],
        hostids: hostIds,
        search: { key_: 'icmpping' },
      },
      id: 3,
      auth,
    });

    // 2b) Itens agent.ping (opcional, para composição de status)
    const itemsAgent = await zabbixRequest({
      jsonrpc: '2.0',
      method: 'item.get',
      params: {
        output: ['itemid', 'hostid', 'lastvalue', 'key_'],
        hostids: hostIds,
        search: { key_: 'agent.ping' },
      },
      id: 4,
      auth,
    });

    // 2c) Disponibilidade 24h (calculado): icmp.success.24h
    // Disponibilidade agregada: permitir override de key via env (default icmp.success.24h)
    let itemsAvail = [];
    try {
      itemsAvail = await zabbixRequest({
        jsonrpc: '2.0',
        method: 'item.get',
        params: {
          output: ['itemid', 'hostid', 'lastvalue', 'key_'],
          hostids: hostIds,
          filter: { key_: ZABBIX_AVAIL_KEYS },
        },
        id: 5,
        auth,
      });
      // fallback: se nada vier, tenta por substring 'icmp.success.24h'/'availability'
      if (!itemsAvail || !itemsAvail.length) {
        itemsAvail = await zabbixRequest({
          jsonrpc: '2.0',
          method: 'item.get',
          params: {
            output: ['itemid', 'hostid', 'lastvalue', 'key_'],
            hostids: hostIds,
            search: { key_: 'icmp.success.24h' },
          },
          id: 6,
          auth,
        });
      }
    } catch (e) {
      console.warn('[Zabbix][AVAIL] falha ao obter disponibilidade:', e && e.message);
      itemsAvail = [];
    }

    // Seleciona o melhor item icmpping por host, priorizando exatamente icmpping["",10,,32]
    const icmpByHost = {};
    const isIcmpPingBase = (key) => /^icmpping(\[.*\])?$/i.test(String(key || ''));
    // aceita icmpping["",10,,32] e icmpping[,10,,32] (com espaços opcionais)
    const isPreferredIcmp = (key) => {
      const k = String(key || '').toLowerCase().replace(/\s+/g, '');
      return k === 'icmpping["",10,,32]' || k === 'icmpping[,10,,32]';
    };
    items.forEach(item => {
      const key = item && item.key_;
      if (!isIcmpPingBase(key)) return;
      let val = null;
      if (item.lastvalue != null) {
        if (typeof item.lastvalue === 'number') val = item.lastvalue;
        else {
          const s = String(item.lastvalue);
          const m = s.match(/\b([01])\b/);
          if (m) val = Number(m[1]);
          else {
            const sl = s.toLowerCase();
            if (sl.includes('up')) val = 1; else if (sl.includes('down')) val = 0; else val = Number(s);
          }
        }
      }
      if (!(val === 1 || val === 0)) return;
      const hostid = item.hostid;
      const current = icmpByHost[hostid];
      const pref = isPreferredIcmp(key) ? 2 : 1;
      if (!current || pref > current.pref) {
        icmpByHost[hostid] = { val, pref, key };
      }
    });

    // agent.ping por host
    const agentByHost = {};
    itemsAgent.forEach(item => {
      const key = String(item && item.key_ || '').toLowerCase();
      if (key !== 'agent.ping') return;
      let val = null;
      if (item.lastvalue != null) {
        if (typeof item.lastvalue === 'number') val = item.lastvalue;
        else {
          const s = String(item.lastvalue);
          const m = s.match(/\b([01])\b/);
          if (m) val = Number(m[1]);
          else {
            const sl = s.toLowerCase();
            if (sl.includes('up')) val = 1; else if (sl.includes('down')) val = 0; else val = Number(s);
          }
        }
      }
      if (val === 1 || val === 0) agentByHost[item.hostid] = { val, key };
    });

    // disponibilidade por host (percentual)
    const availabilityByHost = {};
    itemsAvail.forEach(item => {
      let val = null;
      if (item.lastvalue != null) {
        const n = Number(item.lastvalue);
        if (Number.isFinite(n)) val = n;
        else {
          const s = String(item.lastvalue);
          const m = s.match(/[-+]?[0-9]*\.?[0-9]+/);
          if (m) {
            const f = Number(m[0]);
            if (Number.isFinite(f)) val = f;
          }
        }
      }
      if (val != null) availabilityByHost[item.hostid] = val;
    });

    // Métricas RSSI & LQI
  let rssiItems = [];
  let lqiItems = [];
    const rssiByHostId = {};
    const lqiByHostId = {};
    if (ZABBIX_FETCH_SIGNAL) {
      // Preferir chaves exatas se fornecidas
      if (ZABBIX_RSSI_KEYS.length) {
        try {
          rssiItems = await zabbixRequest({
            jsonrpc: '2.0',
            method: 'item.get',
            params: { output: ['itemid','hostid','key_','lastvalue'], hostids: hostIds, filter: { key_: ZABBIX_RSSI_KEYS } },
            id: 103,
            auth,
          });
        } catch (e) { console.warn('[Zabbix][RSSI] falha na coleta exata:', e && e.message); }
      }
      if (!rssiItems.length) {
        try {
          rssiItems = await zabbixRequest({
            jsonrpc: '2.0',
            method: 'item.get',
            params: { output: ['itemid','hostid','key_','lastvalue'], hostids: hostIds, search: { key_: 'rssi' } },
            id: 101,
            auth,
          });
        } catch (e) { console.warn('[Zabbix][RSSI] falha na coleta substring rssi:', e && e.message); }
      }

      if (ZABBIX_LQI_KEYS.length) {
        try {
          lqiItems = await zabbixRequest({
            jsonrpc: '2.0',
            method: 'item.get',
            params: { output: ['itemid','hostid','key_','lastvalue'], hostids: hostIds, filter: { key_: ZABBIX_LQI_KEYS } },
            id: 104,
            auth,
          });
        } catch (e) { console.warn('[Zabbix][LQI] falha na coleta exata:', e && e.message); }
      }
      if (!lqiItems.length) {
        try {
          lqiItems = await zabbixRequest({
            jsonrpc: '2.0',
            method: 'item.get',
            params: { output: ['itemid','hostid','key_','lastvalue'], hostids: hostIds, search: { key_: 'lqi' } },
            id: 102,
            auth,
          });
        } catch (e) { console.warn('[Zabbix][LQI] falha na coleta substring lqi:', e && e.message); }
      }

      const normalizeNum = (raw) => {
        if (raw == null) return null;
        if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
        const s = String(raw).trim();
        if (!s) return null;
        const m = s.match(/[-+]?[0-9]*\.?[0-9]+/);
        if (!m) return null;
        const n = Number(m[0]);
        return Number.isFinite(n) ? n : null;
      };

      // Selecionar melhor RSSI por host: preferir valor negativo (dBm típico) se existir; senão primeiro numérico.
      const rssiTemp = {};
      for (const it of rssiItems) {
        const hostid = it.hostid;
        const val = normalizeNum(it.lastvalue);
        if (val == null) continue;
        const current = rssiTemp[hostid];
        const isNegative = val < 0;
        if (!current) {
          rssiTemp[hostid] = { val, negative: isNegative };
        } else {
          // Substitui se o novo for negativo e o anterior não, ou mantém o primeiro negativo mais forte (menor número)
          if (isNegative && !current.negative) {
            rssiTemp[hostid] = { val, negative: true };
          } else if (isNegative && current.negative && val < current.val) {
            rssiTemp[hostid] = { val, negative: true };
          }
        }
      }
      Object.entries(rssiTemp).forEach(([hid, obj]) => { rssiByHostId[hid] = obj.val; });

      // Selecionar melhor LQI por host: normalmente 0–255 ou 0–100. Escolher o maior valor numérico.
      const lqiTemp = {};
      for (const it of lqiItems) {
        const hostid = it.hostid;
        const val = normalizeNum(it.lastvalue);
        if (val == null) continue;
        const current = lqiTemp[hostid];
        if (!current || val > current.val) lqiTemp[hostid] = { val };
      }
      Object.entries(lqiTemp).forEach(([hid, obj]) => { lqiByHostId[hid] = obj.val; });
    }

    // Compor status final por hostid conforme regra
    const statusById = {};
    const selectedByHost = {};
    hosts.forEach(h => {
      const hostid = h.hostid;
      const icmp = icmpByHost[hostid]?.val;
      const agent = agentByHost[hostid]?.val;
      const avail = Number(h.available);
      let final;
      if (ZABBIX_STATUS_RULE === 'icmp_only') {
        // Estritamente pelo ICMP: Up (1) => online, Down (0) => offline
        if (icmp === 1) final = 1;
        else if (icmp === 0) final = 0;
        else final = undefined; // sem icmp válido => indefinido
      } else {
        // agent_or_icmp (padrão)
        if (icmp === 1 || agent === 1 || avail === 1) final = 1;
        else if (icmp === 0 || agent === 0 || avail === 2) final = 0;
      }
      if (final === 1 || final === 0) statusById[hostid] = final;
      selectedByHost[hostid] = {
        icmpKey: icmpByHost[hostid]?.key || null,
        icmpVal: (icmp === 1 || icmp === 0) ? icmp : null,
        agentVal: (agent === 1 || agent === 0) ? agent : null,
        available: Number.isFinite(avail) ? avail : null,
        final: (final === 1 || final === 0) ? final : null,
      };
    });

    const hostNameById = {};
    const statusByNormalizedName = {};
    hosts.forEach(h => {
      hostNameById[h.hostid] = h.name;
      const norm = normalizeName(h.name);
      if (norm && statusById[h.hostid] !== undefined) {
        statusByNormalizedName[norm] = statusById[h.hostid];
      }
    });

  return { statusById, hostNameById, statusByNormalizedName, items, selectedByHost, availabilityByHost, rssiByHostId, lqiByHostId };
  } catch (err) {
    console.error('Falha ao obter status Zabbix:', err.message);
    return { statusById: {}, hostNameById: {}, statusByNormalizedName: {}, items: [], selectedByHost: {}, availabilityByHost: {}, rssiByHostId: {}, lqiByHostId: {} };
  }
}

// Executa ping no SO (cross-platform)
function systemPing(target, { timeoutMs = 2000 } = {}) {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    const cmd = isWin
      ? `ping -n 1 -w ${Math.max(1, Math.floor(timeoutMs))} ${target}`
      : `ping -c 1 -W ${Math.ceil(timeoutMs / 1000)} ${target}`;
    const t = setTimeout(() => resolve({ success: false, timeMs: null, error: 'timeout' }), timeoutMs + 500);
    const t0 = Date.now();
    exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
      clearTimeout(t);
      // Em muitos SOs, exitCode 0 = sucesso, !=0 = falha; vamos confiar nisso e não no parse do stdout
      const dt = Date.now() - t0;
      if (err) {
        resolve({ success: false, timeMs: dt, error: (stderr && String(stderr).trim()) || err.message || 'failed' });
      } else {
        resolve({ success: true, timeMs: dt });
      }
    });
  });
}

// Resolve IP/dns de hosts pelo Zabbix
async function resolveTargetsByNames(names) {
  if (!Array.isArray(names) || !names.length) return {};
  try {
    const auth = await ensureZabbixAuth();
    // Busca hosts por nome
    const hosts = await zabbixRequest({
      jsonrpc: '2.0',
      method: 'host.get',
      params: { output: ['hostid', 'name'], filter: { name: names } },
      id: 401,
      auth,
    });
    if (!hosts || !hosts.length) return {};
    const hostids = hosts.map(h => h.hostid);
    const ifaces = await zabbixRequest({
      jsonrpc: '2.0',
      method: 'hostinterface.get',
      params: { output: ['hostid','ip','dns','useip','main'], hostids: hostids },
      id: 402,
      auth,
    });
    const ifaceByHost = new Map();
    (ifaces || []).forEach(i => {
      const key = String(i.hostid);
      const entry = ifaceByHost.get(key) || [];
      entry.push(i);
      ifaceByHost.set(key, entry);
    });
    const pickIface = (arr) => {
      if (!arr || !arr.length) return null;
      let main = arr.find(a => String(a.main) === '1');
      if (!main) main = arr[0];
      if (!main) return null;
      const useip = String(main.useip) === '1';
      const target = useip ? (main.ip || null) : (main.dns || null);
      return target && String(target).trim() ? String(target).trim() : null;
    };
    const targetByName = {};
    hosts.forEach(h => {
      const ifaceArr = ifaceByHost.get(String(h.hostid)) || [];
      const tgt = pickIface(ifaceArr);
      if (tgt) targetByName[h.name] = tgt;
    });
    return targetByName;
  } catch (e) {
    console.warn('[Ping][resolve] falha ao resolver IPs:', e && e.message);
    return {};
  }
}

// Resolve hostids por nome (para operações via Zabbix API)
async function resolveHostIdsByNames(names) {
  if (!Array.isArray(names) || !names.length) return {};
  try {
    const auth = await ensureZabbixAuth();
    const hosts = await zabbixRequest({
      jsonrpc: '2.0',
      method: 'host.get',
      params: { output: ['hostid', 'name'], filter: { name: names } },
      id: 403,
      auth,
    });
    const byName = {};
    (hosts || []).forEach(h => { byName[h.name] = String(h.hostid); });
    return byName;
  } catch (e) {
    console.warn('[Ping][resolveHostIds] falha ao resolver hostids:', e && e.message);
    return {};
  }
}

// Compatibilidade: função antiga usada em alguns pontos (retorna apenas mapa por id)
async function fetchIcmpStatusByTemplate() {
  const { statusById } = await safeFetchIcmpStatusWithHosts();
  return statusById;
}

// Wrapper seguro: chama fetchIcmpStatusWithHosts se disponível, senão retorna mapas vazios
async function safeFetchIcmpStatusWithHosts() {
  if (typeof fetchIcmpStatusWithHosts === 'function') {
    try {
      return await fetchIcmpStatusWithHosts();
    } catch (err) {
      console.error('[Zabbix] fetchIcmpStatusWithHosts falhou:', err && err.message);
      return { statusById: {}, hostNameById: {}, statusByNormalizedName: {}, items: [], selectedByHost: {} };
    }
  }
  console.warn('[Zabbix] fetchIcmpStatusWithHosts não está definida; retornando mapas vazios');
  return { statusById: {}, hostNameById: {}, statusByNormalizedName: {}, items: [], selectedByHost: {} };
}

// (Definido depois da criação do app)

const FRONT_ORIGIN = process.env.FRONT_ORIGIN || 'http://localhost:3000';
const app = express();
// Necessário quando a app roda atrás de proxy/túnel (Cloudflare/ngrok) para respeitar
// x-forwarded-proto e gerar cookies/redirects corretamente.
app.set('trust proxy', true);
app.use(cookieParser());
app.use(cors({
  origin: (origin, cb) => {
    // Requests sem Origin (curl, server-to-server) devem passar
    if (!origin) return cb(null, true);
    try {
      const u = new URL(origin);
      if (origin === FRONT_ORIGIN) return cb(null, true);
      if (/\.trycloudflare\.com$/i.test(u.hostname)) return cb(null, true);
      return cb(null, false);
    } catch (e) {
      return cb(null, false);
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
}));
app.use(express.json());

// Servir a UI de login (build Vite) em /Login
const loginDist = path.join(__dirname, 'Login', 'dist');
app.use('/Login', express.static(loginDist));
// allow absolute asset paths generated by Vite (e.g., /assets/*)
app.use('/assets', express.static(path.join(loginDist, 'assets')));
app.get(['/Login', '/Login/*'], (req, res) => {
  const idx = path.join(loginDist, 'index.html');
  res.sendFile(idx, (err) => {
    if (err) {
      console.error('[Static][Login] erro ao enviar index.html', err && err.message);
      res.status(500).send('Erro interno ao servir a tela de login');
    }
  });
});

// Servir o build de produção do React (se existir)
app.use(express.static(path.join(__dirname, 'build')));

// Nota: a rota /ParanaNetwork será montada mais abaixo de forma protegida
// após o inicializador do auth (necessário para obter o middleware que valida o token).

// Nota: o roteador /auth é montado mais abaixo de forma assíncrona
// porque o driver SQL (sql.js / WASM) requer inicialização assíncrona.
// Isso evita tentar require('./auth/authRoutes') antes do DB estar pronto.

const pool = mysql.createPool({
  ...DB_CONFIG,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

pool.on('error', (err) => {
  console.error('[MySQL][pool error]', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UnhandledRejection]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err);
});

async function queryWithRetry(sql, params = [], { retries = DB_MAX_RETRIES, delayMs = DB_RETRY_DELAY_MS } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await pool.query(sql, params);
      return result;
    } catch (err) {
      lastErr = err;
      const code = err && (err.code || err.errno || err.sqlState);
      const transient = ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'EPIPE', 'ETIMEDOUT', 'ESOCKET'];
      if (attempt < retries && transient.some(t => String(code).includes(t))) {
        await sleep(delayMs * (attempt + 1));
        continue;
      }
      break;
    }
  }
  throw lastErr;
}

// Health endpoint para diagnosticar auth e alguns status
app.get("/api/health/zabbix", async (req, res) => {
  try {
    const auth = await ensureZabbixAuth();
  const { statusById, hostNameById, items, selectedByHost, availabilityByHost, rssiByHostId, lqiByHostId } = await safeFetchIcmpStatusWithHosts();
    const entries = Object.entries(statusById);
    const online = entries.filter(([, v]) => v === 1).length;
    const offline = entries.filter(([, v]) => v === 0).length;
    if (req.query.raw === '1') {
      const itemsSimplified = items.map(i => ({ hostid: i.hostid, key_: i.key_, lastvalue: i.lastvalue }));
      res.json({ ok: true, auth: !!auth, hosts: hostNameById, statusById, items: itemsSimplified, selected: selectedByHost, availabilityByHost, rssiByHostId, lqiByHostId, rule: ZABBIX_STATUS_RULE });
      return;
    }
    const availCount = availabilityByHost ? Object.keys(availabilityByHost).length : 0;
    res.json({ ok: true, auth: !!auth, totalHosts: entries.length, online, offline, availCount, rssiHosts: Object.keys(rssiByHostId).length, lqiHosts: Object.keys(lqiByHostId).length, sample: entries.slice(0, 10), rule: ZABBIX_STATUS_RULE });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Auth-only: testa apenas login no Zabbix (isola problemas de item/host)
app.get('/api/health/zabbix-auth', async (req, res) => {
  try {
    const auth = await ensureZabbixAuth();
    res.json({ ok: true, auth: !!auth });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, url: ZABBIX_URL, timeoutMs: ZABBIX_TIMEOUT_MS, retries: ZABBIX_MAX_RETRIES });
  }
});

// Ping HTTP ao endpoint JSON-RPC para verificar conectividade e TLS (retorna status mesmo que 405)
app.get('/api/health/zabbix-ping', async (req, res) => {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(new Error('timeout')), Math.min(4000, ZABBIX_TIMEOUT_MS));
    const r = await fetch(`${ZABBIX_URL}/api_jsonrpc.php`, { method: 'GET', signal: controller.signal });
    clearTimeout(t);
    res.json({ ok: true, status: r.status, url: `${ZABBIX_URL}/api_jsonrpc.php` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message, url: `${ZABBIX_URL}/api_jsonrpc.php` });
  }
});

// Depuração focada: detalhes do Zabbix para um host específico
app.get('/api/debug/zabbix-host', async (req, res) => {
  try {
    const id = req.query.hostid && String(req.query.hostid).trim();
    const name = req.query.name && String(req.query.name).trim();
    if (!id && !name) return res.status(400).json({ ok: false, error: 'Informe ?hostid=123 ou ?name=HOST-NOME' });
    const auth = await ensureZabbixAuth();
    // Busca host por id ou nome
    let hosts = [];
    if (id) {
      hosts = await zabbixRequest({ jsonrpc: '2.0', method: 'host.get', params: { output: ['hostid','name','available'], hostids: [id] }, id: 11, auth });
    } else {
      hosts = await zabbixRequest({ jsonrpc: '2.0', method: 'host.get', params: { output: ['hostid','name','available'], filter: { name: [name] } }, id: 12, auth });
    }
    if (!hosts || !hosts.length) return res.json({ ok: true, found: false });
    const host = hosts[0];
    const items = await zabbixRequest({ jsonrpc: '2.0', method: 'item.get', params: { output: ['itemid','hostid','key_','lastvalue'], hostids: [host.hostid] }, id: 13, auth });
    const icmp = items.filter(i => /^icmpping(\[.*\])?$/i.test(String(i.key_||''))).map(i => ({ key: i.key_, lastvalue: i.lastvalue }));
    const agent = items.filter(i => String(i.key_||'').toLowerCase() === 'agent.ping').map(i => ({ key: i.key_, lastvalue: i.lastvalue }));
    return res.json({ ok: true, host, icmpping: icmp, agent });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Versão/Build do backend
app.get('/api/health/build', (req, res) => {
  res.json({ ok: true, build: BUILD_TAG });
});

// Health DB
app.get('/api/health/db', async (req, res) => {
  try {
    const [rows] = await queryWithRetry('SELECT 1 AS ok');
    res.json({ ok: true, rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, code: e.code });
  }
});

// API: ping em equipamentos por nome executado via Zabbix (usa itens icmpping/icmppingsec)
app.post('/api/ping', async (req, res) => {
  try {
    const body = req.body || {};
    const rawNames = Array.isArray(body.names) ? body.names : [];
    const names = rawNames
      .map(s => String(s || '').trim())
      .filter(Boolean)
      .slice(0, 300); // limite de segurança
    if (!names.length) return res.status(400).json({ ok: false, error: 'Informe ao menos um nome em names[]' });

    // Resolve IP/dns (para exibição) e hostids (para consulta de itens)
    const [targets, hostIdsByName] = await Promise.all([
      resolveTargetsByNames(names),
      resolveHostIdsByNames(names),
    ]);

    const hostids = Object.values(hostIdsByName).filter(Boolean);
    if (!hostids.length) {
      const results = names.map(n => ({ name: n, target: targets[n] || null, success: false, timeMs: null, error: 'host-not-found' }));
      return res.json({ ok: true, total: names.length, okCount: 0, failCount: results.length, results });
    }

  // Coleta itens icmpping, icmppingsec e icmppingloss dos hosts
    const auth = await ensureZabbixAuth();
    const items = await zabbixRequest({
      jsonrpc: '2.0',
      method: 'item.get',
      params: {
        output: ['itemid','hostid','key_','lastvalue','lastclock'],
        hostids: hostids,
        search: { key_: 'icmpping' },
      },
      id: 404,
      auth,
    });

    // Disponibilidade (24h) icmp.success.24h
    let itemsAvail = [];
    try {
      itemsAvail = await zabbixRequest({
        jsonrpc: '2.0',
        method: 'item.get',
        params: {
          output: ['itemid','hostid','key_','lastvalue'],
          hostids: hostids,
          filter: { key_: ZABBIX_AVAIL_KEYS },
        },
        id: 405,
        auth,
      });
      if (!itemsAvail || !itemsAvail.length) {
        itemsAvail = await zabbixRequest({
          jsonrpc: '2.0',
          method: 'item.get',
          params: {
            output: ['itemid','hostid','key_','lastvalue'],
            hostids: hostids,
            search: { key_: 'icmp.success.24h' },
          },
          id: 406,
          auth,
        });
      }
    } catch (e) { itemsAvail = []; }

    // RSSI/LQI
    let rssiItems = [];
    let lqiItems = [];
    const tryNum = (raw) => {
      if (raw == null) return null;
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      const m = String(raw).match(/[-+]?[0-9]*\.?[0-9]+/);
      return m ? Number(m[0]) : null;
    };
    try {
      if (ZABBIX_RSSI_KEYS && ZABBIX_RSSI_KEYS.length) {
        rssiItems = await zabbixRequest({ jsonrpc: '2.0', method: 'item.get', params: { output: ['itemid','hostid','key_','lastvalue'], hostids, filter: { key_: ZABBIX_RSSI_KEYS } }, id: 407, auth });
      }
      if (!rssiItems.length) {
        rssiItems = await zabbixRequest({ jsonrpc: '2.0', method: 'item.get', params: { output: ['itemid','hostid','key_','lastvalue'], hostids, search: { key_: 'rssi' } }, id: 408, auth });
      }
    } catch (e) { rssiItems = []; }
    try {
      if (ZABBIX_LQI_KEYS && ZABBIX_LQI_KEYS.length) {
        lqiItems = await zabbixRequest({ jsonrpc: '2.0', method: 'item.get', params: { output: ['itemid','hostid','key_','lastvalue'], hostids, filter: { key_: ZABBIX_LQI_KEYS } }, id: 409, auth });
      }
      if (!lqiItems.length) {
        lqiItems = await zabbixRequest({ jsonrpc: '2.0', method: 'item.get', params: { output: ['itemid','hostid','key_','lastvalue'], hostids, search: { key_: 'lqi' } }, id: 410, auth });
      }
    } catch (e) { lqiItems = []; }

    // Separar por host: icmpping (binário) e icmppingsec (tempo)
  const byHost = {};
    const toNum = (v) => {
      if (v == null) return null;
      if (typeof v === 'number') return Number.isFinite(v) ? v : null;
      const s = String(v);
      const m = s.match(/[-+]?[0-9]*\.?[0-9]+/);
      return m ? Number(m[0]) : null;
    };
    const isIcmp = (k) => /^icmpping(\[.*\])?$/i.test(String(k||''));
    const isIcmpPreferred = (k) => {
      const kk = String(k||'').toLowerCase().replace(/\s+/g,'');
      return kk === 'icmpping["",10,,32]' || kk === 'icmpping[,10,,32]';
    };
    const isSec = (k) => /^icmppings(ec|ec)?$/i.test(String(k||'').replace(/\s+/g,'')) || String(k||'').toLowerCase().includes('icmppingsec');
    const isLoss = (k) => /^icmppingloss(\[.*\])?$/i.test(String(k||''));

    (items || []).forEach(it => {
      const hostid = String(it.hostid);
      const k = it.key_ || '';
      const lastclock = it.lastclock ? Number(it.lastclock) : null;
      if (!byHost[hostid]) byHost[hostid] = { icmp: null, icmpPref: false, sec: null, lossPct: null, lastclock: null };
      if (isIcmp(k)) {
        const val = toNum(it.lastvalue);
        const pref = isIcmpPreferred(k);
        const curr = byHost[hostid].icmp;
        const currPref = byHost[hostid].icmpPref;
        if (val === 0 || val === 1) {
          if (curr == null || (pref && !currPref)) {
            byHost[hostid].icmp = val;
            byHost[hostid].icmpPref = pref;
            byHost[hostid].lastclock = lastclock;
          }
        }
      } else if (isSec(k)) {
        const sec = toNum(it.lastvalue);
        if (sec != null) {
          // manter o menor tempo mais recente
          if (byHost[hostid].sec == null || (lastclock && (!byHost[hostid].lastclock || lastclock >= byHost[hostid].lastclock))) {
            byHost[hostid].sec = sec;
            byHost[hostid].lastclock = lastclock;
          }
        }
      } else if (isLoss(k)) {
        const loss = toNum(it.lastvalue);
        if (loss != null) {
          // mantém o valor mais recente
          if (byHost[hostid].lossPct == null || (lastclock && (!byHost[hostid].lastclock || lastclock >= byHost[hostid].lastclock))) {
            // clamp 0..100
            const clamped = Math.max(0, Math.min(100, loss));
            byHost[hostid].lossPct = clamped;
            byHost[hostid].lastclock = lastclock;
          }
        }
      }
    });

    // availability map
    const availabilityByHost = {};
    (itemsAvail || []).forEach(it => {
      const n = tryNum(it.lastvalue);
      if (n != null) availabilityByHost[String(it.hostid)] = n;
    });

    // rssi: prefer valores negativos (mais comum em dBm); se múltiplos, mantém o negativo mais forte (menor número);
    const rssiByHost = {};
    (rssiItems || []).forEach(it => {
      const hid = String(it.hostid);
      const val = tryNum(it.lastvalue);
      if (val == null) return;
      const cur = rssiByHost[hid];
      const neg = val < 0;
      if (!cur) {
        rssiByHost[hid] = { val, neg };
      } else {
        if (neg && !cur.neg) rssiByHost[hid] = { val, neg };
        else if (neg && cur.neg && val < cur.val) rssiByHost[hid] = { val, neg };
      }
    });

    // lqi: manter o maior valor
    const lqiByHost = {};
    (lqiItems || []).forEach(it => {
      const hid = String(it.hostid);
      const val = tryNum(it.lastvalue);
      if (val == null) return;
      if (lqiByHost[hid] == null || val > lqiByHost[hid]) lqiByHost[hid] = val;
    });

    // Busca taxa de transmissão no GLPI (taxadetransmissofield) por nome
    let txByName = {};
    try {
      if (names.length) {
        const placeholders = names.map(() => '?').join(',');
        const [rows] = await queryWithRetry(`
          SELECT p.name AS nome, pd.taxadetransmissofield AS tx
          FROM glpi_peripherals p
          JOIN glpi_plugin_fields_peripheraldispositivos pd ON p.id = pd.items_id
          WHERE p.is_deleted = 0 AND p.name IN (${placeholders})
        `, names);
        txByName = (rows || []).reduce((acc, r) => {
          const raw = r && r.tx != null ? String(r.tx) : '';
          const m = raw.match(/[0-9]{2,4}/);
          const n = m ? Number(m[0]) : null;
          if (n) acc[r.nome] = n; // ex.: 250, 500, 1000
          return acc;
        }, {});
      }
    } catch (e) { txByName = {}; }

    // Monta resultados por nome na ordem solicitada
    const results = names.map(name => {
      const hostid = hostIdsByName[name] ? String(hostIdsByName[name]) : null;
      const target = targets[name] || null;
      if (!hostid || !byHost[hostid]) {
        return { name, target, success: false, timeMs: null, error: 'host-or-item-not-found' };
      }
      const icmp = byHost[hostid].icmp;
      const sec = byHost[hostid].sec;
      const lossPct = byHost[hostid].lossPct;
      const lc = byHost[hostid].lastclock;
      const availPct = availabilityByHost[hostid] != null ? availabilityByHost[hostid] : null;
      const rssi = (rssiByHost[hostid] && rssiByHost[hostid].val != null) ? rssiByHost[hostid].val : null;
      const lqi = lqiByHost[hostid] != null ? lqiByHost[hostid] : null;
      const txRateKbps = txByName[name] != null ? txByName[name] : null;
      const success = icmp === 1;
      const timeMs = (sec != null && Number.isFinite(sec)) ? Math.round(sec * 1000) : null;
      const successPct = (lossPct != null && Number.isFinite(lossPct)) ? Math.max(0, Math.min(100, Math.round(100 - lossPct))) : null;
      return {
        name,
        target,
        success,
        timeMs,
        lastclock: lc || null,
        lossPct: (lossPct != null ? Math.round(lossPct) : null),
        successPct,
        availabilityPct: (availPct != null ? Math.round(availPct * 100) / 100 : null),
        rssi,
        lqi,
        txRateKbps,
        error: null
      };
    });

    const okCount = results.filter(r => r && r.success).length;
    const failCount = results.filter(r => r && !r.success).length;
    res.json({ ok: true, total: names.length, okCount, failCount, results, via: 'zabbix-items' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Health: coluna "ID Próximo Equipamento"
app.get('/api/health/glpi-proximo', async (req, res) => {
  try {
    const col = await detectProximoColumn();
    if (!col) {
      return res.json({ ok: true, detectedColumn: null, countNonEmpty: 0, samples: [] });
    }
    const [rows] = await queryWithRetry(`
      SELECT ${'`'}${col}${'`'} AS val
      FROM glpi_plugin_fields_peripheraldispositivos
      WHERE ${'`'}${col}${'`'} IS NOT NULL AND ${'`'}${col}${'`'} <> ''
      LIMIT 50
    `);
    const samples = rows.map(r => r.val).filter(Boolean);
    res.json({ ok: true, detectedColumn: col, countNonEmpty: samples.length, samples });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Health: coluna "ID B2B"
app.get('/api/health/glpi-b2b', async (req, res) => {
  try {
    const col = await detectB2bColumn();
    if (!col) {
      return res.json({ ok: true, detectedColumn: null, countNonEmpty: 0, samples: [] });
    }
    const [rows] = await queryWithRetry(`
      SELECT ${'`'}${col}${'`'} AS val
      FROM glpi_plugin_fields_peripheraldispositivos
      WHERE ${'`'}${col}${'`'} IS NOT NULL AND ${'`'}${col}${'`'} <> ''
      LIMIT 50
    `);
    const samples = rows.map(r => r.val).filter(Boolean);
    res.json({ ok: true, detectedColumn: col, countNonEmpty: samples.length, samples });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const enforceCoordinateRange = (value, type) => {
  if (!Number.isFinite(value)) {
    return null;
  }

  const limit = type === "latitude" ? 90 : 180;
  return Math.abs(value) <= limit ? value : null;
};

const parseCoordinate = (value, type) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const rawText = String(value).trim();
  if (!rawText) {
    return null;
  }

  const normalizedText = rawText.replace(/,/g, ".").toUpperCase();
  const directionMatch = normalizedText.match(/[NSEW]/);

  const resolveSign = (baseValue) => {
    if (directionMatch) {
      const direction = directionMatch[0];
      if (direction === "S" || direction === "W") {
        return -1;
      }
      if (direction === "N" || direction === "E") {
        return 1;
      }
    }
    if (baseValue < 0) {
      return -1;
    }
    if (/^-/.test(normalizedText)) {
      return -1;
    }
    return 1;
  };

  if (/[°º'"]/.test(normalizedText)) {
    const sanitizedForDms = normalizedText.replace(/[^0-9.+\-°º'"\s]/g, " ");
    const dmsParts = sanitizedForDms
      .split(/[^0-9.+\-]+/)
      .filter(Boolean)
      .map(Number.parseFloat);

    if (!dmsParts.length || !Number.isFinite(dmsParts[0])) {
      return null;
    }

    const [degreesRaw, minutesRaw = 0, secondsRaw = 0] = dmsParts;
    const sign = resolveSign(degreesRaw);
    const decimal =
      Math.abs(degreesRaw) +
      Math.abs(minutesRaw) / 60 +
      Math.abs(secondsRaw) / 3600;

    const result = decimal * sign;
    return enforceCoordinateRange(result, type);
  }

  const decimalMatch = normalizedText.match(/[+-]?\d+(?:\.\d+)?/);
  if (!decimalMatch) {
    return null;
  }

  const parsed = Number.parseFloat(decimalMatch[0]);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const sign = resolveSign(parsed);
  const result = Math.abs(parsed) * sign;
  return enforceCoordinateRange(result, type);
};

// Normaliza nome da subestação: remove espaços extras, força maiúsculas, padroniza hífen
function normalizeSubstationName(raw) {
  if (!raw) return null;
  let v = String(raw).trim();
  if (!v) return null;
  // Substitui sequências de espaços por um espaço
  v = v.replace(/\s+/g, ' ');
  // Remove espaços antes e depois de hífen
  v = v.replace(/\s*-\s*/g, '-');
  // Força maiúsculas
  v = v.toUpperCase();
  return v;
}

// Normaliza nome para regras (maiúsculas, hífens unicode -> '-', remove espaços ao redor de '-')
function normalizeNameForRules(raw) {
  if (!raw) return "";
  return String(raw)
    .trim()
    .toUpperCase()
    // substitui várias variantes de hífen por '-'
    .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    // remove espaços ao redor de '-'
    .replace(/\s*-\s*/g, '-');
}

// Sanitiza o campo "ID Próximo Equipamento": remove placeholders e normaliza alvos múltiplos
function sanitizeProximo(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  if (!text) return null;
  const parts = text
    .split(/[\/;,\n]+/)
    .map(s => String(s).trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const isPlaceholder = (s) => {
    const u = String(s).trim().toUpperCase();
    if (!u) return true;
    if (/^0+$/.test(u)) return true; // "0", "00", ...
    const bad = new Set(['N/A','NA','ND','#N/D','NULL','NULO','SEM','SEM LINK','FALTA ANALISE COPEL','FALTA ANÁLISE COPEL','ANALISE COPEL','ANÁLISE COPEL','-']);
    if (bad.has(u)) return true;
    // muito curto para ser nome útil
    if (u.length < 3) return true;
    return false;
  };
  const kept = parts.filter(p => !isPlaceholder(p));
  if (!kept.length) return null;
  return kept.join(' / ');
}

// Considera "0", "00", etc. como valor nulo/placeholder
function isZeroish(v) {
  const s = String(v ?? '').trim();
  if (!s) return false;
  return /^0+$/.test(s);
}

// Remove segmentos "0" de rótulos compostos (ex.: "NOME/0" -> "NOME")
function stripZeroishSegmentsLabel(label) {
  if (label == null) return label;
  const text = String(label);
  if (!text.includes('/')) return text;
  const parts = text.split('/').map(s => String(s).trim());
  const kept = parts.filter(p => p && !isZeroish(p));
  if (kept.length === 0) {
    // se tudo era zero, retorna primeira parte original sem zeros explícitos
    return parts.find(p => p && !isZeroish(p)) || String(parts[0] || '').trim();
  }
  return kept.join('/');
}

// Testa se um nome seria excluído pelas regras
app.get('/api/debug/exclude-test', (req, res) => {
  const name = req.query.name || '';
  const normName = normalizeNameForRules(name);
  const containsSR = normName.includes('-S-R-');
  const seventhIsR = normName.length >= 7 && normName[6] === 'R';
  const tokens = normName.split('-').filter(Boolean);
  const thirdTokenIsR = tokens.length >= 3 && tokens[2] === 'R';
  const excluded = containsSR || seventhIsR || thirdTokenIsR;
  res.json({ name, normName, containsSR, seventhIsR, tokens, thirdTokenIsR, excluded });
});

app.get("/api/radios", async (req, res) => {
  try {
    const toArray = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      return [value];
    };
    const rawGroupParams = [
      ...toArray(req.query.group),
      ...toArray(req.query.groups),
    ];
    const normalizedGroupFilters = new Set(
      rawGroupParams
        .flatMap(val => String(val || '')
          .split(',')
          .map(piece => piece.trim())
          .filter(Boolean))
        .map(normalizeSubstationName)
        .filter(Boolean)
    );
    // Detecta a coluna de próximo equipamento (uma vez)
    const proxCol = await detectProximoColumn();
    const proximoSelect = proxCol
      ? `pd.${proxCol} AS idProximoEquipamento, pd.${proxCol} AS \`ID Próximo Equipamento\``
      : `NULL AS idProximoEquipamento, NULL AS \`ID Próximo Equipamento\``;
    // Detecta a coluna de ID B2B (dinâmico)
    const b2bCol = await detectB2bColumn();
  // Seleciona sempre a coluna de B2B (dinâmica), com fallback explícito para idbtwobfield.
  // A lógica de uso (apenas quando tipo for B2B) fica no JS.
  const b2bExpr = b2bCol ? `pd.${b2bCol}` : 'pd.idbtwobfield';
  const b2bSelect = `${b2bExpr} AS idB2b, ${b2bExpr} AS \`ID B2B\``;
    const [rows] = await queryWithRetry(
      `SELECT
        p.id AS id,
        p.name AS nome,
        s.name AS glpiStatus,
        pd.latitudefield AS latitude,
        pd.longitudefield AS longitude,
        pd.pspostefield AS pspostefield,
        pd.subestaofield AS subestacao,
        tipodeequipamento.name AS tipoEquipamento,
        modooperacao.name AS modoOperacao,
        tipodeantena.name AS tipodeantena,
        pd.azimutefield AS azimutefield,
        pd.iddcufield AS idDcu,
        ${b2bSelect},
        ${proximoSelect}
  FROM glpi_peripherals p
  JOIN glpi_plugin_fields_peripheraldispositivos pd ON p.id = pd.items_id
      LEFT JOIN glpi_plugin_fields_tipodeequipamentofielddropdowns tipodeequipamento
        ON pd.plugin_fields_tipodeequipamentofielddropdowns_id = tipodeequipamento.id
      LEFT JOIN glpi_plugin_fields_mododeoperaofielddropdowns modooperacao
        ON pd.plugin_fields_mododeoperaofielddropdowns_id = modooperacao.id
      LEFT JOIN glpi_plugin_fields_tipodeantenafielddropdowns tipodeantena
        ON pd.plugin_fields_tipodeantenafielddropdowns_id = tipodeantena.id
      LEFT JOIN glpi_states s ON p.states_id = s.id
  WHERE p.is_deleted = 0`
    );

  const { statusById, hostNameById, statusByNormalizedName, availabilityByHost, rssiByHostId, lqiByHostId } = await safeFetchIcmpStatusWithHosts();

    // Mapas auxiliares
    const statusByExactName = {}; // nome original -> status
    Object.entries(hostNameById).forEach(([hostid, hName]) => {
      const st = statusById[hostid];
      if (st !== undefined) statusByExactName[hName] = st;
    });

    let foundById = 0;
    let foundByExactName = 0;
    let foundByNormalized = 0;
  let foundByFuzzy = 0;
    let notFound = 0;

    // Funções auxiliares
    const normalizeTypeLabel = (raw) => String(raw || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();

    const isGabDcuGe = (tipoRaw) => {
      const t = normalizeTypeLabel(tipoRaw);
      return t.includes('gab') && t.includes('dcu') && t.includes('ge') && !t.includes('b2b');
    };
    const isGabDcuGeB2b = (tipoRaw) => {
      const t = normalizeTypeLabel(tipoRaw);
      return t.includes('gab') && t.includes('dcu') && t.includes('ge') && t.includes('b2b');
    };
    const isB2bOnly = (tipoRaw) => {
      const t = normalizeTypeLabel(tipoRaw);
      // B2B puro: exatamente 'b2b' ou contém b2b sem gab/dcu/ge
      if (!t) return false;
      if (t === 'b2b') return true;
      return t.includes('b2b') && !(t.includes('gab') || t.includes('dcu') || t.includes('ge'));
    };
    const isDA = (tipoRaw) => {
      const t = normalizeTypeLabel(tipoRaw);
      if (!t) return false;
      return t === 'da' || t.startsWith('da ');
    };

    // Primeiro passe: processa linhas válidas (sem filtrar unknown aqui)
    const processed = rows
      .map((row) => {
        const latitude = parseCoordinate(row.latitude, "latitude");
        const longitude = parseCoordinate(row.longitude, "longitude");
        if (latitude === null || longitude === null) return null;

        const glpiStatusRaw = row.glpiStatus ? String(row.glpiStatus).trim() : null;
        const glpiStatusUpper = glpiStatusRaw ? glpiStatusRaw.toUpperCase() : null;
        const glpiStatusComparable = glpiStatusUpper
          ? glpiStatusUpper.normalize('NFD').replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
          : null;
        const removalTokens = ['MIGRADO', 'REMOVIDO', 'EXCLUIDO', 'DESINSTALADO', 'DESINSTALAR'];
        if (glpiStatusComparable && removalTokens.some(token => glpiStatusComparable.includes(token))) {
          return null; // equipamentos removidos não devem aparecer no mapa
        }
        const forceInactiveByGlpi = glpiStatusUpper ? (glpiStatusUpper !== 'INSTALADO') : false;

        // Regras de exclusão por nome
        if (row.nome) {
          const normName = normalizeNameForRules(row.nome);
          // Regra 0: contém '-S-R-' em qualquer posição
          if (normName.includes('-S-R-')) {
            return null;
          }
          // Regra 1: 7º caractere (index 6) == 'R'
          const seventhIsR = normName.length >= 7 && normName[6] === 'R';
          // Regra 2: 3º token separado por '-' == 'R' (ex: AND-S-R-015)
          const tokens = normName.split('-').filter(Boolean);
          const thirdTokenIsR = tokens.length >= 3 && tokens[2] === 'R';
          if (seventhIsR || thirdTokenIsR) {
            return null; // descarta
          }
        }

        const subRaw = row.subestacao || null;
        const subNorm = normalizeSubstationName(subRaw);

        if (normalizedGroupFilters.size) {
          if (!subNorm || !normalizedGroupFilters.has(subNorm)) {
            return null;
          }
        }

        // GLPI id != Zabbix hostid: evitamos mapear por id para não gerar falsos matches
        let statusValue = undefined;
        let source = "not-found";
        // tenta nome exato (case sensitive)
        statusValue = statusByExactName[row.nome];
        if (statusValue !== undefined) source = "name";
        if (statusValue === undefined) {
          // tenta nome normalizado
            const norm = normalizeName(row.nome);
          statusValue = statusByNormalizedName[norm];
          source = "normalized";
        }
        if (statusValue === undefined) {
          // tentativa fuzzy mais segura: tokens + Jaccard + penalização por diferença de tamanho
          const normRow = normalizeName(row.nome);
          const rowTokens = tokenize(normRow);
          let bestScore = -Infinity;
          let bestVal = undefined;
          let bestKey = null;
          for (const [normKey, stVal] of Object.entries(statusByNormalizedName)) {
            if (!normKey) continue;
            const keyTokens = tokenize(normKey);
            const jac = jaccard(rowTokens, keyTokens);
            const substr = (normKey.includes(normRow) || normRow.includes(normKey)) ? 1 : 0;
            const lenDiff = Math.abs(normKey.length - normRow.length);
            const score = (substr * 1.5) + jac - (lenDiff / 200);
            if (score > bestScore) {
              bestScore = score;
              bestVal = stVal;
              bestKey = normKey;
            }
          }
          // Aplica apenas se o match for realmente forte
          if (bestScore >= 1.2 || (bestScore >= 0.95 && bestKey && Math.abs(bestKey.length - normRow.length) <= 3)) {
            statusValue = bestVal;
            source = "fuzzy";
          }
        }

        if (statusValue === undefined) {
          source = "not-found";
        }

        if (source === "id") foundById++; else if (source === "name") foundByExactName++; else if (source === "normalized") foundByNormalized++; else if (source === "fuzzy") foundByFuzzy++; else notFound++;

        let status;
        if (statusValue === undefined) {
          status = "unknown"; // sem correspondência
        } else if (statusValue === 1) {
          status = "online";
        } else if (statusValue === 0) {
          status = "offline";
        } else {
          status = "unknown";
        }
        if (forceInactiveByGlpi) {
          status = 'inactive';
        }
        const idB2bRaw = (row.idB2b !== undefined ? row.idB2b : (row["ID B2B"] !== undefined ? row["ID B2B"] : (row.idbtwobfield !== undefined ? row.idbtwobfield : null)));
        const idB2bClean = isZeroish(idB2bRaw) ? null : idB2bRaw;
        const idDcuClean = isZeroish(row.idDcu) ? null : row.idDcu;
        const hostIdExact = Object.entries(hostNameById).find(([hid, hName]) => hName === row.nome)?.[0];
        const resultItem = {
          id: row.id,
          name: row.nome,
          glpiStatus: glpiStatusRaw,
          latitude,
          longitude,
          status,
          _statusSource: source,
          subestacao: subNorm,
          tipoEquipamento: row.tipoEquipamento || null,
          modoOperacao: row.modoOperacao || null,
          pspostefield: row.pspostefield || null,
          tipodeantena: row.tipodeantena || null,
          azimutefield: row.azimutefield || null,
          idDcu: idDcuClean || null,
          idB2b: idB2bClean || null,
          idProximoEquipamento: sanitizeProximo(row.idProximoEquipamento),
          // Métricas de sinal referenciadas diretamente pelo frontend (tooltip)
          rssi: hostIdExact && rssiByHostId[hostIdExact] != null ? rssiByHostId[hostIdExact] : null,
          lqi: hostIdExact && lqiByHostId[hostIdExact] != null ? lqiByHostId[hostIdExact] : null,
          // Disponibilidade 24h (percentual)
          'icmp.success.24h': (() => {
            if (hostIdExact && availabilityByHost[hostIdExact] != null) return availabilityByHost[hostIdExact];
            return null;
          })(),
        };
        // Disponibilidade 24h (icmp.success.24h) — se nome casar com host Zabbix
        try {
          const availKey = Object.entries(hostNameById).find(([, hName]) => hName === row.nome)?.[0];
          if (availKey && availabilityByHost[availKey] != null) {
            // chave exata solicitada com ponto
            resultItem['icmp.success.24h'] = availabilityByHost[availKey];
          }
        } catch {}
        // Log de diagnóstico para o caso citado (sem expor em produção massivamente)
        try {
          const up = String(resultItem.name || '').toUpperCase();
          if (up.includes('MIL-S-P7-001')) {
            console.info('[Diag][Match] MIL-S-P7-001', {
              name: resultItem.name,
              status: resultItem.status,
              source: resultItem._statusSource,
            });
          }
        } catch {}
        return resultItem;
      })
      .filter(Boolean);

    // Índices auxiliares
  const byNormalizedName = new Map();
  const byStrongName = new Map();
  const normName = (s) => String(s || '').trim().toLowerCase();
  const strong = (s) => normalizeName(String(s || ''));
    processed.forEach((r) => {
      const k1 = normName(r.name);
      const k2 = strong(r.name);
      if (k1) byNormalizedName.set(k1, r);
      if (k2) byStrongName.set(k2, r);
    });

    
    const consumed = new Set();
    const radios = [];

    for (const r of processed) {
      if (consumed.has(r.id)) continue;

      // Tratamento prioritário para DA: nunca agrega nem concatena, e remove '/0' do próprio nome
      if (isDA(r.tipoEquipamento)) {
        radios.push({
          id: r.id,
          name: stripZeroishSegmentsLabel(r.name),
          latitude: r.latitude,
          longitude: r.longitude,
          status: r.status,
          _statusSource: r._statusSource,
          subestacao: r.subestacao,
          tipoEquipamento: r.tipoEquipamento,
          pspostefield: r.pspostefield || null,
          forceShow: false,
          idProximoEquipamento: r.idProximoEquipamento || null,
        });
        consumed.add(r.id);
        continue;
      }

      // Agregação Gab. DCU+GE+B2B (usa idB2b e idDcu para encontrar até 2 parceiros)
      if (isGabDcuGeB2b(r.tipoEquipamento)) {
        // helper para achar parceiro pelo texto
        const findPartnerByText = (raw) => {
          if (!raw) return null;
          const key1 = normName(raw);
          const key2 = strong(raw);
          if (key2 && byStrongName.has(key2)) return byStrongName.get(key2);
          if (key1 && byNormalizedName.has(key1)) return byNormalizedName.get(key1);
          const target = key2 || key1;
          if (target) {
            for (const [k, cand] of byStrongName.entries()) {
              if (k.includes(target) || target.includes(k)) return cand;
            }
            for (const [k, cand] of byNormalizedName.entries()) {
              if (k.includes(key1) || key1.includes(k)) return cand;
            }
          }
          return null;
        };

        const primary = r;
        const partnerB2b = r.idB2b ? findPartnerByText(r.idB2b) : null;
        const partnerDcu = r.idDcu ? findPartnerByText(r.idDcu) : null;

  const names = [];
  const segs = [];
        const addSeg = (text, status) => {
          const t = String(text || '').trim();
          if (!t) return;
          if (isZeroish(t)) return;
          if (!names.includes(t)) {
            names.push(t);
            segs.push({ text: t, status });
          }
        };

        addSeg(primary.name, primary.status);
        addSeg(partnerB2b?.name || String(r.idB2b || ''), partnerB2b?.status || 'unknown');
        addSeg(partnerDcu?.name || String(r.idDcu || ''), partnerDcu?.status || 'unknown');

        // Ordena segmentos: GE primeiro, depois A, depois demais
        const rank = (t) => {
          const u = String(t || '').toUpperCase();
          if (/-GE-/.test(u)) return 1;
          if (/-A-/.test(u)) return 2;
          return 3;
        };
        segs.sort((a,b) => {
          const ra = rank(a.text), rb = rank(b.text);
          if (ra !== rb) return ra - rb;
          const ta = String(a.text || '').toUpperCase();
          const tb = String(b.text || '').toUpperCase();
          return ta.localeCompare(tb, undefined, { sensitivity: 'base', numeric: true });
        });

        // Calcula status agregado: online se qualquer online; offline se todos conhecidos e offline; senão unknown
        const statuses = segs.map(s => s.status);
        const anyOnline = statuses.includes('online');
        const known = statuses.filter(s => s === 'online' || s === 'offline');
        const allOffline = known.length && known.every(s => s === 'offline') && !anyOnline;
        const allInactive = statuses.length && statuses.every(s => s === 'inactive');
        const aggregatedStatus = anyOnline
          ? 'online'
          : (allOffline ? 'offline' : (allInactive ? 'inactive' : 'unknown'));

        // Enriquecer segmentos com métricas individuais (RSSI, LQI, Disponibilidade)
        const enrichedSegs = segs.map(sg => {
          const hid = Object.entries(hostNameById).find(([hId, hName]) => hName === sg.text)?.[0];
          const rssiVal = hid && rssiByHostId[hid] != null ? Number(rssiByHostId[hid]) : null;
          const lqiVal = hid && lqiByHostId[hid] != null ? Number(lqiByHostId[hid]) : null;
          const availVal = hid && availabilityByHost[hid] != null ? Number(availabilityByHost[hid]) : null;
          const src = [primary, partnerB2b, partnerDcu].find(x => x && x.name === sg.text);
          const tipoSeg = src && src.tipoEquipamento ? String(src.tipoEquipamento) : null;
          const modoSeg = src && src.modoOperacao ? String(src.modoOperacao) : null;
          return { text: sg.text, status: sg.status, rssi: rssiVal, lqi: lqiVal, 'icmp.success.24h': availVal, tipoEquipamento: tipoSeg, modoOperacao: modoSeg };
        });

        

        const combined = {
          id: [primary.id, partnerB2b?.id, partnerDcu?.id].filter(Boolean).join('+') || String(primary.id),
          name: stripZeroishSegmentsLabel(names.filter(Boolean).join('/')),
          latitude: primary.latitude,
          longitude: primary.longitude,
          status: aggregatedStatus,
          _statusSource: `aggregated:${primary._statusSource}${partnerB2b ? '+' + partnerB2b._statusSource : ''}${partnerDcu ? '+' + partnerDcu._statusSource : ''}`,
          subestacao: primary.subestacao,
          tipoEquipamento: primary.tipoEquipamento,
          modoOperacao: primary.modoOperacao || null,
          pspostefield: primary.pspostefield || null,
          tipodeantena: (() => {
            const set = new Set();
            segs.forEach(sg => {
              // procurar objeto original
              const src = [primary, partnerB2b, partnerDcu].find(x => x && x.name === sg.text);
              if (src && src.tipodeantena) {
                const v = String(src.tipodeantena).trim();
                if (v) set.add(v);
              }
            });
            return Array.from(set).join('/') || null;
          })(),
          azimutefield: (() => {
            const set = new Set();
            [primary, partnerB2b, partnerDcu].forEach(src => {
              if (src && src.azimutefield != null) {
                const v = String(src.azimutefield).trim();
                if (v) set.add(v);
              }
            });
            return Array.from(set).join('/') || null;
          })(),
          forceShow: true,
          labelSegments: enrichedSegs,
          idProximoEquipamento: primary.idProximoEquipamento || null,
          // RSSI/LQI agregados (média simples dos segmentos com valor)
          rssi: (() => {
            const values = segs.map(sg => {
              const hid = Object.entries(hostNameById).find(([hId, hName]) => hName === sg.text)?.[0];
              return hid && rssiByHostId[hid] != null ? Number(rssiByHostId[hid]) : null;
            }).filter(v => v != null);
            if (!values.length) return null;
            return Number((values.reduce((a,b)=>a+b,0) / values.length).toFixed(1));
          })(),
          lqi: (() => {
            const values = segs.map(sg => {
              const hid = Object.entries(hostNameById).find(([hId, hName]) => hName === sg.text)?.[0];
              return hid && lqiByHostId[hid] != null ? Number(lqiByHostId[hid]) : null;
            }).filter(v => v != null);
            if (!values.length) return null;
            return Math.round(values.reduce((a,b)=>a+b,0) / values.length);
          })(),
          'icmp.success.24h': (() => {
            const values = segs.map(sg => {
              const hid = Object.entries(hostNameById).find(([hId, hName]) => hName === sg.text)?.[0];
              return hid && availabilityByHost[hid] != null ? Number(availabilityByHost[hid]) : null;
            }).filter(v => v != null);
            if (!values.length) return null;
            return Math.round(values.reduce((a,b)=>a+b,0) / values.length);
          })(),
        };

        radios.push(combined);
        consumed.add(primary.id);
        if (partnerB2b) consumed.add(partnerB2b.id);
        if (partnerDcu) consumed.add(partnerDcu.id);
        continue;
      }

      // Agregação para tipo puro "B2B": replica a lógica do Gab. DCU+GE+B2B, mas sem a parte de IDDCU
      if (isB2bOnly(r.tipoEquipamento) && r.idB2b) {
        // helper local para achar parceiro por texto
        const findPartnerByText = (raw) => {
          if (!raw) return null;
          const key1 = normName(raw);
          const key2 = strong(raw);
          if (key2 && byStrongName.has(key2)) return byStrongName.get(key2);
          if (key1 && byNormalizedName.has(key1)) return byNormalizedName.get(key1);
          const target = key2 || key1;
          if (target) {
            for (const [k, cand] of byStrongName.entries()) {
              if (k.includes(target) || target.includes(k)) return cand;
            }
            for (const [k, cand] of byNormalizedName.entries()) {
              if (k.includes(key1) || key1.includes(k)) return cand;
            }
          }
          return null;
        };

        const primary = r;
        const partnerB2b = r.idB2b ? findPartnerByText(r.idB2b) : null;

        const names = [];
        const segs = [];
        const addSeg = (text, status) => {
          const t = String(text || '').trim();
          if (!t) return;
          if (isZeroish(t)) return;
          if (!names.includes(t)) {
            names.push(t);
            segs.push({ text: t, status });
          }
        };

        addSeg(primary.name, primary.status);
        addSeg(partnerB2b?.name || String(r.idB2b || ''), partnerB2b?.status || 'unknown');

        // Ordenação consistente com outras agregações (GE primeiro, depois A)
        const rank = (t) => {
          const u = String(t || '').toUpperCase();
          if (/-GE-/.test(u)) return 1;
          if (/-A-/.test(u)) return 2;
          return 3;
        };
        segs.sort((a,b) => {
          const ra = rank(a.text), rb = rank(b.text);
          if (ra !== rb) return ra - rb;
          const ta = String(a.text || '').toUpperCase();
          const tb = String(b.text || '').toUpperCase();
          return ta.localeCompare(tb, undefined, { sensitivity: 'base', numeric: true });
        });

        // Status agregado: qualquer online => online; todos conhecidos offline => offline; senão unknown
        const statuses = segs.map(s => s.status);
        const anyOnline = statuses.includes('online');
        const known = statuses.filter(s => s === 'online' || s === 'offline');
        const allOffline = known.length && known.every(s => s === 'offline') && !anyOnline;
        const allInactive = statuses.length && statuses.every(s => s === 'inactive');
        const aggregatedStatus = anyOnline
          ? 'online'
          : (allOffline ? 'offline' : (allInactive ? 'inactive' : 'unknown'));

        // Enriquecer segmentos com métricas individuais
        const enrichedSegs = segs.map(sg => {
          const hid = Object.entries(hostNameById).find(([hId, hName]) => hName === sg.text)?.[0];
          const rssiVal = hid && rssiByHostId[hid] != null ? Number(rssiByHostId[hid]) : null;
          const lqiVal = hid && lqiByHostId[hid] != null ? Number(lqiByHostId[hid]) : null;
          const availVal = hid && availabilityByHost[hid] != null ? Number(availabilityByHost[hid]) : null;
          const src = [primary, partnerB2b].find(x => x && x.name === sg.text);
          const tipoSeg = src && src.tipoEquipamento ? String(src.tipoEquipamento) : null;
          const modoSeg = src && src.modoOperacao ? String(src.modoOperacao) : null;
          return { text: sg.text, status: sg.status, rssi: rssiVal, lqi: lqiVal, 'icmp.success.24h': availVal, tipoEquipamento: tipoSeg, modoOperacao: modoSeg };
        });

        const combined = {
          id: [primary.id, partnerB2b?.id].filter(Boolean).join('+') || String(primary.id),
          name: stripZeroishSegmentsLabel(names.filter(Boolean).join('/')),
          latitude: primary.latitude,
          longitude: primary.longitude,
          status: aggregatedStatus,
          _statusSource: `aggregated:${primary._statusSource}${partnerB2b ? '+' + partnerB2b._statusSource : ''}`,
          subestacao: primary.subestacao,
          tipoEquipamento: primary.tipoEquipamento,
          modoOperacao: primary.modoOperacao || null,
          pspostefield: primary.pspostefield || null,
          tipodeantena: (() => {
            const set = new Set();
            segs.forEach(sg => {
              const src = [primary, partnerB2b].find(x => x && x.name === sg.text);
              if (src && src.tipodeantena) {
                const v = String(src.tipodeantena).trim();
                if (v) set.add(v);
              }
            });
            return Array.from(set).join('/') || null;
          })(),
          azimutefield: (() => {
            const set = new Set();
            [primary, partnerB2b].forEach(src => {
              if (src && src.azimutefield != null) {
                const v = String(src.azimutefield).trim();
                if (v) set.add(v);
              }
            });
            return Array.from(set).join('/') || null;
          })(),
          forceShow: true,
          labelSegments: enrichedSegs,
          idProximoEquipamento: primary.idProximoEquipamento || null,
          rssi: (() => {
            const values = segs.map(sg => {
              const hid = Object.entries(hostNameById).find(([hId, hName]) => hName === sg.text)?.[0];
              return hid && rssiByHostId[hid] != null ? Number(rssiByHostId[hid]) : null;
            }).filter(v => v != null);
            if (!values.length) return null;
            return Number((values.reduce((a,b)=>a+b,0) / values.length).toFixed(1));
          })(),
          lqi: (() => {
            const values = segs.map(sg => {
              const hid = Object.entries(hostNameById).find(([hId, hName]) => hName === sg.text)?.[0];
              return hid && lqiByHostId[hid] != null ? Number(lqiByHostId[hid]) : null;
            }).filter(v => v != null);
            if (!values.length) return null;
            return Math.round(values.reduce((a,b)=>a+b,0) / values.length);
          })(),
          'icmp.success.24h': (() => {
            const values = segs.map(sg => {
              const hid = Object.entries(hostNameById).find(([hId, hName]) => hName === sg.text)?.[0];
              return hid && availabilityByHost[hid] != null ? Number(availabilityByHost[hid]) : null;
            }).filter(v => v != null);
            if (!values.length) return null;
            return Math.round(values.reduce((a,b)=>a+b,0) / values.length);
          })(),
        };

        radios.push(combined);
        consumed.add(primary.id);
        if (partnerB2b) consumed.add(partnerB2b.id);
        continue;
      }

      if (isGabDcuGe(r.tipoEquipamento) && r.idDcu) {
        // Busca robusta do parceiro pelo campo idDcu (nome): exato forte, depois aproximação por inclusão
        let partner = null;
        const rawKey = r.idDcu;
        const key1 = normName(rawKey);
        const key2 = strong(rawKey);
        if (key2 && byStrongName.has(key2)) {
          partner = byStrongName.get(key2);
        } else if (key1 && byNormalizedName.has(key1)) {
          partner = byNormalizedName.get(key1);
        } else {
          // tentativa por inclusão
          const target = key2 || key1;
          if (target) {
            for (const [k, cand] of byStrongName.entries()) {
              if (k.includes(target) || target.includes(k)) { partner = cand; break; }
            }
            if (!partner) {
              for (const [k, cand] of byNormalizedName.entries()) {
                if (k.includes(key1) || key1.includes(k)) { partner = cand; break; }
              }
            }
          }
        }
        // Construir nome composto e status agregado
        const primaryName = r.name;
        const secondaryName = partner?.name || (r.idDcu ? String(r.idDcu) : '');
        const s1 = r.status;
        const s2 = partner?.status || 'unknown';

        const segs = [ { text: primaryName, status: s1 } ];
        if (secondaryName && secondaryName.trim()) {
          segs.push({ text: secondaryName, status: s2 });
        }
        const rank = (t) => {
          const u = String(t || '').toUpperCase();
          if (/-GE-/.test(u)) return 1;
          if (/-A-/.test(u)) return 2;
          return 3;
        };
        segs.sort((a,b) => {
          const ra = rank(a.text), rb = rank(b.text);
          if (ra !== rb) return ra - rb;
          const ta = String(a.text || '').toUpperCase();
          const tb = String(b.text || '').toUpperCase();
          return ta.localeCompare(tb, undefined, { sensitivity: 'base', numeric: true });
        });

        const bothOffline = segs.every(s => s.status === 'offline');
        const anyOnline = segs.some(s => s.status === 'online');
        const aggregatedStatus = bothOffline ? 'offline' : (anyOnline ? 'online' : 'unknown');

        // Enriquecer segmentos com métricas individuais
        const enrichedSegs = segs.map(sg => {
          const hid = Object.entries(hostNameById).find(([hId, hName]) => hName === sg.text)?.[0];
          const rssiVal = hid && rssiByHostId[hid] != null ? Number(rssiByHostId[hid]) : null;
          const lqiVal = hid && lqiByHostId[hid] != null ? Number(lqiByHostId[hid]) : null;
          const availVal = hid && availabilityByHost[hid] != null ? Number(availabilityByHost[hid]) : null;
          const src = [r, partner].filter(Boolean).find(x => x && x.name === sg.text);
          const tipoSeg = src && src.tipoEquipamento ? String(src.tipoEquipamento) : null;
          const modoSeg = src && src.modoOperacao ? String(src.modoOperacao) : null;
          return { text: sg.text, status: sg.status, rssi: rssiVal, lqi: lqiVal, 'icmp.success.24h': availVal, tipoEquipamento: tipoSeg, modoOperacao: modoSeg };
        });

        const combined = {
          id: partner ? `${r.id}+${partner.id}` : `${r.id}+${secondaryName}`,
          name: segs.map(s => s.text).join(' / '),
          latitude: r.latitude, // força coordenadas do gabinete (r)
          longitude: r.longitude,
          status: aggregatedStatus,
          _statusSource: `aggregated:${r._statusSource}${partner ? '+' + partner._statusSource : ''}`,
          subestacao: r.subestacao,
          tipoEquipamento: r.tipoEquipamento, // mapeado para ícone Gab. DCU no frontend
          modoOperacao: r.modoOperacao || null,
          pspostefield: r.pspostefield || null,
          tipodeantena: (() => {
            const set = new Set();
            [r, partner].forEach(src => {
              if (src && src.tipodeantena) {
                const v = String(src.tipodeantena).trim();
                if (v) set.add(v);
              }
            });
            return Array.from(set).join('/') || null;
          })(),
          azimutefield: (() => {
            const set = new Set();
            [r, partner].forEach(src => {
              if (src && src.azimutefield != null) {
                const v = String(src.azimutefield).trim();
                if (v) set.add(v);
              }
            });
            return Array.from(set).join('/') || null;
          })(),
          forceShow: true,
          labelSegments: enrichedSegs,
          idProximoEquipamento: r.idProximoEquipamento || null,
          rssi: (() => {
            const values = segs.map(sg => {
              const hid = Object.entries(hostNameById).find(([hId, hName]) => hName === sg.text)?.[0];
              return hid && rssiByHostId[hid] != null ? Number(rssiByHostId[hid]) : null;
            }).filter(v => v != null);
            if (!values.length) return null;
            return Number((values.reduce((a,b)=>a+b,0) / values.length).toFixed(1));
          })(),
          lqi: (() => {
            const values = segs.map(sg => {
              const hid = Object.entries(hostNameById).find(([hId, hName]) => hName === sg.text)?.[0];
              return hid && lqiByHostId[hid] != null ? Number(lqiByHostId[hid]) : null;
            }).filter(v => v != null);
            if (!values.length) return null;
            return Math.round(values.reduce((a,b)=>a+b,0) / values.length);
          })(),
          'icmp.success.24h': (() => {
            const values = segs.map(sg => {
              const hid = Object.entries(hostNameById).find(([hId, hName]) => hName === sg.text)?.[0];
              return hid && availabilityByHost[hid] != null ? Number(availabilityByHost[hid]) : null;
            }).filter(v => v != null);
            if (!values.length) return null;
            return Math.round(values.reduce((a,b)=>a+b,0) / values.length);
          })(),
        };
        radios.push(combined);
        consumed.add(r.id);
        if (partner) consumed.add(partner.id);
        continue;
      }

      // Caso normal (não agregado)
      // Regra: se houver ID B2B e não for um agregado (Gab. DCU/GE/B2B) e NÃO for tipo DA, concatena "nome/idB2b"
      let displayName = r.name;
      if (r.idB2b && !isGabDcuGe(r.tipoEquipamento) && !isGabDcuGeB2b(r.tipoEquipamento) && !isDA(r.tipoEquipamento)) {
        const suffix = String(r.idB2b).trim();
        if (suffix) {
          // Sem espaços, conforme solicitado: EXEMPLO1/EXEMPLO2
          displayName = `${r.name}/${suffix}`;
        }
      }
      displayName = stripZeroishSegmentsLabel(displayName);

      radios.push({
        id: r.id,
        name: displayName,
        latitude: r.latitude,
        longitude: r.longitude,
        status: r.status,
        _statusSource: r._statusSource,
        subestacao: r.subestacao,
        tipoEquipamento: r.tipoEquipamento,
        modoOperacao: r.modoOperacao || null,
        pspostefield: r.pspostefield || null,
        forceShow: false,
        idProximoEquipamento: r.idProximoEquipamento || null,
        // Se o nome final tiver múltiplos segmentos separados por '/', expor métricas individuais também
        labelSegments: (() => {
          const parts = String(displayName).split(/\//).map(s => s.trim()).filter(Boolean);
          if (parts.length <= 1) return null;
          return parts.map(p => {
            // localizar hostid para métricas
            const hid = Object.entries(hostNameById).find(([hId, hName]) => hName === p)?.[0];
            const rssiVal = hid && rssiByHostId[hid] != null ? Number(rssiByHostId[hid]) : null;
            const lqiVal = hid && lqiByHostId[hid] != null ? Number(lqiByHostId[hid]) : null;
            const availVal = hid && availabilityByHost[hid] != null ? Number(availabilityByHost[hid]) : null;
            // status: tenta achar item processado original
            const ref = processed.find(pr => pr && pr.name === p);
            const segStatus = ref ? ref.status : 'unknown';
            const tipoSeg = ref && ref.tipoEquipamento ? String(ref.tipoEquipamento) : null;
            const modoSeg = ref && ref.modoOperacao ? String(ref.modoOperacao) : null;
            return { text: p, status: segStatus, rssi: rssiVal, lqi: lqiVal, 'icmp.success.24h': availVal, tipoEquipamento: tipoSeg, modoOperacao: modoSeg };
          });
        })(),
        rssi: (() => {
          const parts = String(displayName).split(/\//).map(s=>s.trim()).filter(Boolean);
          const values = parts.map(p => {
            const hid = Object.entries(hostNameById).find(([hId,hName]) => hName === p)?.[0];
            return hid && rssiByHostId[hid] != null ? Number(rssiByHostId[hid]) : null;
          }).filter(v => v != null);
          if (!values.length) return null;
          return values.length === 1 ? values[0] : Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(1));
        })(),
        lqi: (() => {
          const parts = String(displayName).split(/\//).map(s=>s.trim()).filter(Boolean);
          const values = parts.map(p => {
            const hid = Object.entries(hostNameById).find(([hId,hName]) => hName === p)?.[0];
            return hid && lqiByHostId[hid] != null ? Number(lqiByHostId[hid]) : null;
          }).filter(v => v != null);
          if (!values.length) return null;
          return values.length === 1 ? values[0] : Math.round(values.reduce((a,b)=>a+b,0)/values.length);
        })(),
        'icmp.success.24h': (() => {
          const parts = String(displayName).split(/\//).map(s=>s.trim()).filter(Boolean);
          const values = parts.map(p => {
            const hid = Object.entries(hostNameById).find(([hId,hName]) => hName === p)?.[0];
            return hid && availabilityByHost[hid] != null ? Number(availabilityByHost[hid]) : null;
          }).filter(v => v != null);
          if (!values.length) return null;
          return Math.round(values.reduce((a,b)=>a+b,0)/values.length);
        })(),
      });
    }

    // Ocultar pontos com status 'unknown' por padrão, a menos que ?showUnknown=1
    const showUnknown = req.query.showUnknown === '1' || req.query.showUnknown === 1 || req.query.showUnknown === true;
    if (!showUnknown) {
      // Mantém agregados mesmo unknown
      for (let i = radios.length - 1; i >= 0; i--) {
        const r = radios[i];
        if (r.status === 'unknown' && !r.forceShow) radios.splice(i, 1);
      }
    }

    if (req.query.debug === "1") {
      const aggregatedItems = radios.filter(r => Array.isArray(r.labelSegments) && r.labelSegments.length > 1).slice(0, 50);
      res.json({
        radios,
        mapping: { foundById, foundByExactName, foundByNormalized, foundByFuzzy, notFound, totalRadios: radios.length },
        aggregated: { count: aggregatedItems.length, sample: aggregatedItems.map(a => ({ name: a.name, status: a.status, labelSegments: a.labelSegments })) }
      });
      return;
    }

  res.json({ radios, group: normalizedGroupFilters.size ? Array.from(normalizedGroupFilters) : null });
  } catch (error) {
    console.error("Erro ao consultar o banco de dados:", error);
    res.status(500).json({ message: "Erro ao consultar o banco de dados" });
  }
});

// Endpoint lista de grupos (subestações distintas)
app.get('/api/groups', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT DISTINCT pd.subestaofield AS subestacao
       FROM glpi_plugin_fields_peripheraldispositivos pd
       WHERE pd.subestaofield IS NOT NULL AND pd.subestaofield <> ''
       ORDER BY pd.subestaofield`);
    const seen = new Set();
    const groups = [];
    rows.forEach(r => {
      const norm = normalizeSubstationName(r.subestacao);
      // Filtro extra: ignorar "0" e sequências numéricas longas suspeitas (> 6 dígitos)
      if (norm && !seen.has(norm) && !/^0+$/.test(norm) && !/^\d{7,}$/.test(norm)) {
        seen.add(norm);
        groups.push(norm);
      }
    });
    groups.sort();
    res.json({ groups });
  } catch (err) {
    console.error('Erro ao listar grupos:', err);
    res.status(500).json({ message: 'Erro ao listar grupos' });
  }
});

// Diagnóstico: lista os "Tipos de Equipamento" e suas contagens
app.get('/api/debug/types', async (req, res) => {
  try {
    const [rows] = await queryWithRetry(`
      SELECT 
        COALESCE(tipodeequipamento.name, '(sem tipo)') AS tipo,
        COUNT(*) AS total
      FROM glpi_peripherals p
      JOIN glpi_plugin_fields_peripheraldispositivos pd ON p.id = pd.items_id
      LEFT JOIN glpi_plugin_fields_tipodeequipamentofielddropdowns tipodeequipamento
        ON pd.plugin_fields_tipodeequipamentofielddropdowns_id = tipodeequipamento.id
      WHERE p.is_deleted = 0
      GROUP BY tipo
      ORDER BY total DESC, tipo ASC
    `);
    res.json({ ok: true, tipos: rows });
  } catch (err) {
    console.error('Erro ao listar tipos:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Inicialização assíncrona: carrega DB (sql.js) e monta rotas de auth antes de iniciar
(async () => {
  try {
    const authDb = require('./auth/db');
    if (authDb && typeof authDb.initDB === 'function') {
      // initDB deverá carregar e retornar um objeto DB com métodos usados por authRoutes
      const dbInstance = await authDb.initDB();
      try {
        const createAuthRouter = require('./auth/authRoutes');
        const authRouter = createAuthRouter(dbInstance);
        app.use('/auth', authRouter);
        console.log('[Auth] auth routes mounted at /auth');
        // if the router exposes createAuthMiddlewareRedirect, protect browser SPA routes
        if (authRouter && typeof authRouter.createAuthMiddlewareRedirect === 'function') {
          const authRedirect = authRouter.createAuthMiddlewareRedirect();
          // root and ParanaNetwork should require authentication and redirect to /Login if missing
          app.get('/', authRedirect, (req, res) => {
            const idx = path.join(__dirname, 'build', 'index.html');
            res.sendFile(idx, (err) => {
              if (err) {
                console.error('[Static][/ root] erro ao enviar index.html', err && err.message);
                res.status(500).send('Erro interno ao servir a aplicação');
              }
            });
          });
          app.get(['/ParanaNetwork', '/ParanaNetwork/*'], authRedirect, (req, res) => {
            const idx = path.join(__dirname, 'build', 'index.html');
            res.sendFile(idx, (err) => {
              if (err) {
                console.error('[Static][ParanaNetwork] erro ao enviar index.html', err && err.message);
                res.status(500).send('Erro interno ao servir a aplicação');
              }
            });
          });
          // Admin dashboard route (SPA) — protege com o mesmo redirect middleware
          app.get(['/dashboard', '/dashboard/*', '/admin', '/admin/*'], authRedirect, (req, res) => {
            const idx = path.join(__dirname, 'build', 'index.html');
            res.sendFile(idx, (err) => {
              if (err) {
                console.error('[Static][dashboard] erro ao enviar index.html', err && err.message);
                res.status(500).send('Erro interno ao servir a aplicação');
              }
            });
          });
          console.log('[Auth] rotas SPA protegidas por autenticação e redirecionamento para /Login');
        } else if (authRouter && typeof authRouter.createAuthMiddleware === 'function') {
          // fallback: protect with API-style middleware (returns 401 JSON)
          const authMiddleware = authRouter.createAuthMiddleware();
          app.get(['/ParanaNetwork', '/ParanaNetwork/*'], authMiddleware, (req, res) => {
            const idx = path.join(__dirname, 'build', 'index.html');
            res.sendFile(idx, (err) => {
              if (err) {
                console.error('[Static][ParanaNetwork] erro ao enviar index.html', err && err.message);
                res.status(500).send('Erro interno ao servir a aplicação');
              }
            });
          });
          console.warn('[Auth] createAuthMiddlewareRedirect não disponível — usando middleware API (401 JSON)');
        } else {
          console.warn('[Auth] createAuthMiddleware não disponível — /ParanaNetwork ficará público');
        }
      } catch (e) {
        console.warn('[Auth] failed to mount authRoutes:', e && e.message);
      }
    }
  } catch (e) {
    console.warn('[Auth] auth DB init skipped or failed:', e && e.message);
  }

  const LISTEN_HOST = process.env.LISTEN_HOST || '127.0.0.1';
  const server = app.listen(PORT, LISTEN_HOST, () => {
    console.log(`Servidor backend ouvindo em http://${LISTEN_HOST}:${PORT}`);
  });

  server.on('error', (err) => {
    console.error('[HTTP][error]', err);
  });

  server.on('listening', () => {
    console.log('[HTTP][listening] true');
  });

  let diagTimer = null;
  let lastListening = null;
  const startDiag = () => {
    if (diagTimer) return;
    diagTimer = setInterval(() => {
      const curr = !!server.listening;
      if (curr !== lastListening) {
        lastListening = curr;
        if (!curr) console.warn('[Diag] server.listening=false');
        else console.log('[Diag] server.listening=true');
      }
    }, 30000);
    diagTimer.unref();
  };
  startDiag();

  server.on('close', () => {
    console.warn('[HTTP][close] Servidor foi fechado');
    if (diagTimer) { clearInterval(diagTimer); diagTimer = null; }
  });

  process.on('exit', (code) => {
    console.warn(`[Process][exit] code=${code}`);
  });
  process.on('beforeExit', (code) => {
    console.warn(`[Process][beforeExit] code=${code}`);
  });

  let isShuttingDown = false;
  const gracefulShutdown = (sig) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.warn(`[Process][signal] ${sig} recebido — encerrando graciosamente...`);
    if (diagTimer) { clearInterval(diagTimer); diagTimer = null; }
    try {
      server.close((err) => {
        if (err) {
          console.error('[HTTP][close error]', err);
          // força saída com erro
          process.exit(1);
        } else {
          process.exit(0);
        }
      });
      // Timeout de segurança: encerra mesmo se algum keep-alive segurar
      setTimeout(() => process.exit(0), 5000).unref();
    } catch (e) {
      console.error('[Shutdown] erro durante shutdown', e && e.message);
      process.exit(1);
    }
  };
  ['SIGINT','SIGTERM','SIGQUIT'].forEach(sig => {
    process.on(sig, () => gracefulShutdown(sig));
  });

  setTimeout(() => {
    console.log('[Diag] Servidor ainda vivo após 5s');
  }, 5000);
})();

// --- Endpoint de depuração de matching ---
function tokenize(str) {
  return normalizeName(str)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (!a.size && !b.size) return 1;
  let inter = 0;
  a.forEach(t => { if (b.has(t)) inter++; });
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

app.get('/api/debug/match', async (req, res) => {
  try {
    const nome = req.query.glpi || req.query.name || '';
    if (!nome) {
      return res.status(400).json({ ok: false, error: 'Informe ?glpi=NomeDoEquipamento' });
    }
  const { statusById, hostNameById, statusByNormalizedName } = await safeFetchIcmpStatusWithHosts();
    const normTarget = normalizeName(nome);
    const targetTokens = tokenize(nome);

    // construir lista de candidatos
    const candidates = Object.entries(hostNameById).map(([hostid, hostName]) => {
      const norm = normalizeName(hostName);
      const tokens = tokenize(hostName);
      const jac = jaccard(targetTokens, tokens);
      const substringScore = norm && normTarget && (norm.includes(normTarget) || normTarget.includes(norm)) ? 1 : 0;
      const lengthDiff = Math.abs(norm.length - normTarget.length);
      const statusVal = statusById[hostid];
      const score = (substringScore * 2) + jac - (lengthDiff / 200); // peso simples
      return { hostid, hostName, norm, score: Number(score.toFixed(4)), status: statusVal };
    });

    candidates.sort((a, b) => b.score - a.score);

    const top = candidates.slice(0, 15);

    // determinar se nome já casa diretamente
    const directNormStatus = statusByNormalizedName[normTarget];

    res.json({
      ok: true,
      query: nome,
      normalized: normTarget,
      directNormStatus,
      topCandidates: top,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Depuração específica de pareamento por nome
app.get('/api/debug/pair', async (req, res) => {
  try {
    const q = String(req.query.name || req.query.n || '').trim();
    if (!q) return res.status(400).json({ ok: false, error: 'Informe ?name=SAT-S-GE-015' });

    const [rows] = await queryWithRetry(
      `SELECT
         p.id AS id,
         p.name AS nome,
         pd.latitudefield AS latitude,
         pd.longitudefield AS longitude,
         tipodeequipamento.name AS tipoEquipamento,
         pd.iddcufield AS idDcu
       FROM glpi_peripherals p
       JOIN glpi_plugin_fields_peripheraldispositivos pd ON p.id = pd.items_id
       LEFT JOIN glpi_plugin_fields_tipodeequipamentofielddropdowns tipodeequipamento
        ON pd.plugin_fields_tipodeequipamentofielddropdowns_id = tipodeequipamento.id
        WHERE p.is_deleted = 0`
    );

    const normSoft = (s) => String(s || '').trim().toLowerCase();
    const normStrong = (s) => normalizeName(String(s || ''));
    const targetSoft = normSoft(q);
    const targetStrong = normStrong(q);

    // Escolhe o item mais semelhante ao alvo
    let primary = null;
    let best = -Infinity;
    for (const r of rows) {
      const s = normSoft(r.nome);
      const st = normStrong(r.nome);
      let score = 0;
      if (s === targetSoft) score += 5;
      if (st === targetStrong) score += 5;
      if (s.includes(targetSoft) || targetSoft.includes(s)) score += 2;
      if (st.includes(targetStrong) || targetStrong.includes(st)) score += 2;
      if (score > best) { best = score; primary = r; }
    }

    if (!primary) return res.json({ ok: true, found: false });

    // Busca parceiro pelo idDcu com as mesmas heurísticas da agregação
    const key1 = normSoft(primary.idDcu);
    const key2 = normStrong(primary.idDcu);
    let partner = null;
    if (key2) partner = rows.find(rr => normStrong(rr.nome) === key2) || null;
    if (!partner && key1) partner = rows.find(rr => normSoft(rr.nome) === key1) || null;
    if (!partner && (key1 || key2)) {
      const tgt = key2 || key1;
      partner = rows.find(rr => {
        const a = normStrong(rr.nome);
        const b = normSoft(rr.nome);
        return a.includes(tgt) || tgt.includes(a) || b.includes(key1) || key1.includes(b);
      }) || null;
    }

    // Status atuais via Zabbix
  const { statusById, hostNameById, statusByNormalizedName } = await safeFetchIcmpStatusWithHosts();
    const mapExact = {}; Object.entries(hostNameById).forEach(([hid, name]) => { const st = statusById[hid]; if (st !== undefined) mapExact[name] = st; });
    const getStatus = (row) => {
      if (!row) return 'unknown';
      let v = statusById[row.id];
      if (v === undefined) v = mapExact[row.nome];
      if (v === undefined) v = statusByNormalizedName[normStrong(row.nome)];
      if (v === 1) return 'online';
      if (v === 0) return 'offline';
      return 'unknown';
    };

    const s1 = getStatus(primary);
    const s2 = getStatus(partner);
    const bothOffline = (s1 === 'offline') && (s2 === 'offline');
    const anyOnline = (s1 === 'online') || (s2 === 'online');
    const aggregatedStatus = bothOffline ? 'offline' : (anyOnline ? 'online' : 'unknown');

    res.json({
      ok: true,
      query: q,
      primary: { id: primary.id, nome: primary.nome, tipo: primary.tipoEquipamento, idDcu: primary.idDcu, latitude: primary.latitudefield, longitude: primary.longitudefield, status: s1 },
      partner: partner ? { id: partner.id, nome: partner.nome, tipo: partner.tipoEquipamento, status: s2 } : null,
      aggregatedStatus,
      notes: partner ? 'Par encontrado e pronto para agregação.' : 'Parceiro não encontrado com as heurísticas atuais; a agregação usa o texto de idDcu com status unknown do parceiro.'
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Depuração: pares agregados Gab. DCU+GE
app.get('/api/debug/aggregate', async (req, res) => {
  try {
    const [rows] = await queryWithRetry(
      `SELECT p.id, p.name AS nome, pd.iddcufield AS idDcu, tipodeequipamento.name AS tipo
       FROM glpi_peripherals p
       JOIN glpi_plugin_fields_peripheraldispositivos pd ON p.id = pd.items_id
       LEFT JOIN glpi_plugin_fields_tipodeequipamentofielddropdowns tipodeequipamento
         ON pd.plugin_fields_tipodeequipamentofielddropdowns_id = tipodeequipamento.id
       WHERE p.is_deleted = 0`
    );
    const norm = (s) => normalizeName(String(s || ''));
    const list = rows.map(r => ({ id: r.id, nome: r.nome, idDcu: r.idDcu, tipo: r.tipo, nKey: norm(r.nome), nPair: norm(r.idDcu) }));
    const gab = list.filter(r => /gab/i.test(r.tipo || '') && /dcu/i.test(r.tipo || '') && /ge/i.test(r.tipo || '') && !/b2b/i.test(r.tipo || ''));
    res.json({ ok: true, total: rows.length, candidatos: gab.length, itens: gab.slice(0, 100) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
