// Proxy simples para encaminhar /Login -> localhost:5000 e o resto -> localhost:3000
// Uso: instalar dependência: `npm install http-proxy --save-dev`
// e executar: `node scripts/proxy-server.js`

const http = require('http');
const httpProxy = require('http-proxy');

const FRONTEND = 'http://localhost:3000';
const BACKEND = 'http://localhost:5000';
const PORT = process.env.PROXY_PORT || 3001;

const proxy = httpProxy.createProxyServer({});

proxy.on('error', (err, req, res) => {
  console.error('Proxy error', err && err.message);
  try {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad gateway');
  } catch (e) {}
});

// Log and rewrite Location headers from backend responses so absolute redirects
// pointing to http://localhost:5000 are rewritten to the incoming host (tunnel)
proxy.on('proxyRes', (proxyRes, req, res) => {
  try {
    const location = proxyRes.headers && proxyRes.headers.location;
    if (location) {
      // If backend redirected to localhost:5000, replace with incoming host/proto
      const incomingHost = req.headers.host || 'localhost:3001';
      const prefersHttps = (req.headers['x-forwarded-proto'] || '').includes('https') || String(incomingHost).includes('trycloudflare');
      const proto = prefersHttps ? 'https' : (String(incomingHost).startsWith('localhost') ? 'http' : 'https');
      const newLocation = String(location).replace(/https?:\/\/localhost:5000/i, `${proto}://${incomingHost}`);
      if (newLocation !== location) {
        proxyRes.headers.location = newLocation;
        // also rewrite 'location' header sent to client
        res.setHeader('location', newLocation);
        console.log(`[proxy] Rewrote Location: ${location} -> ${newLocation}`);
      }
    }
  } catch (e) {
    console.warn('Error rewriting Location header', e && e.message);
  }
});

const server = http.createServer((req, res) => {
  try {
    const url = req.url || '/';
    const target = url.startsWith('/Login') ? BACKEND : FRONTEND;
    console.log(`[proxy] ${req.method} ${url} -> ${target} (Host: ${req.headers.host})`);
    proxy.web(req, res, { target, selfHandleResponse: false });
  } catch (e) {
    console.error('Unexpected proxy handler error', e && e.message);
    res.writeHead(500);
    res.end('Internal proxy error');
  }
});

server.listen(PORT, () => {
  console.log(`Proxy listening on http://localhost:${PORT}`);
  console.log(`- /Login -> ${BACKEND}`);
  console.log(`- /* -> ${FRONTEND}`);
});
