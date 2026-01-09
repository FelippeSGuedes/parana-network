// tools/gateway.js
// Simple HTTP + WS proxy that forwards:
// - /api/* => http://localhost:4000
// - everything else => http://localhost:3000
// - proxies WebSocket upgrades too

const http = require('http');
const httpProxy = require('http-proxy');

const API_TARGET = process.env.API_TARGET || 'http://localhost:4000';
const APP_TARGET = process.env.APP_TARGET || 'http://localhost:3000';
const LISTEN_PORT = Number(process.env.GATEWAY_PORT || 8080);

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  ws: true,
});

proxy.on('error', (err, req, res) => {
  // Log full error for easier debugging
  try {
    console.error('[gateway][proxy error] url=', req && req.url, 'err=', err && (err.stack || err.message || err));
  } catch (logErr) {
    console.error('[gateway][proxy error] (failed to stringify error)', logErr);
  }
  if (!res || res.headersSent) return;
  try {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway');
  } catch (e) {}
});

const server = http.createServer((req, res) => {
  try {
    // route by path
    if (req.url.startsWith('/api') || req.url.startsWith('/auth') || req.url.startsWith('/ParanaNetwork')) {
      proxy.web(req, res, { target: API_TARGET });
    } else {
      proxy.web(req, res, { target: APP_TARGET });
    }
  } catch (e) {
    console.error('[gateway] request handler error', e && e.message);
    if (!res.headersSent) res.writeHead(500).end('Internal Error');
  }
});

// WebSocket upgrades (works for ws/wss)
server.on('upgrade', (req, socket, head) => {
  // default: send WS to app target (CRA dev server) which proxies to backend if needed
  const target = APP_TARGET;
  proxy.ws(req, socket, head, { target });
});

server.listen(LISTEN_PORT, () => {
  console.log(`[gateway] Listening on http://localhost:${LISTEN_PORT}`);
  console.log(`[gateway] proxying /api -> ${API_TARGET}`);
  console.log(`[gateway] proxying other -> ${APP_TARGET}`);
});

// graceful shutdown
process.on('SIGINT', () => {
  console.log('[gateway] SIGINT received, closing');
  server.close(() => process.exit(0));
});
