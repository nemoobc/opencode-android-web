/* server.js — full-web opencode-android (tanpa APK/emulator)
 * Static UI + mock API OpenCode + forward pencarian DDG.
 * Tanpa dependency. Jalan: node server.js [port]
 * Stop: kill $(cat server.pid)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = parseInt(process.argv[2] || '8901', 10);
const ROOT = path.join(__dirname, 'docs');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

let seq = 1;
const sessions = {};

const CANNED = [
  '## Harga Emas Hari Ini\n\nHarga emas naik ke **Rp 1,5 juta** per gram [1].\n\n- Pemicu: permintaan global naik [2]\n- Tren: menguat 3 hari beruntun\n\n```text\nANTAM 1gr = Rp1.500.000\nUBS 1gr   = Rp1.495.000\n```\n\nKesimpulan: cocok buat jaga-jaga, bukan spekulasi [1].',
  '## Hasil Pencarian Web\n\nDitemukan **2 sumber** relevan [1][2]:\n\n1. Judul pertama membahas tren terbaru\n2. Judul kedua berisi data pembanding\n\n> Kutipan: pasar bergerak positif minggu ini.\n\nMau saya gali salah satu sumber lebih dalam? [2]',
];

function sendJson(res, obj, code) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code || 200, { 'Content-Type': 'application/json', 'Content-Length': b.length });
  res.end(b);
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(b));
  });
}

function ddgHtml(q) {
  return new Promise((resolve) => {
    const body = 'q=' + encodeURIComponent(q);
    const r = https.request({
      hostname: 'html.duckduckgo.com', path: '/html/', method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
      },
      timeout: 9000,
    }, (resp) => {
      let d = '';
      resp.on('data', (c) => { d += c; });
      resp.on('end', () => resolve(resp.statusCode === 200 ? d : ''));
    });
    r.on('error', () => resolve(''));
    r.on('timeout', () => { r.destroy(); resolve(''); });
    r.end(body);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');

  // --- mock API OpenCode (format yg dibaca bridge.js web mode) ---
  if (req.method === 'POST' && u.pathname === '/api/session') {
    const id = 's' + (seq++);
    sessions[id] = { msgs: [], n: 0 };
    return sendJson(res, { data: { id } });
  }
  let m = u.pathname.match(/^\/api\/session\/([^/]+)\/prompt$/);
  if (req.method === 'POST' && m && sessions[m[1]]) {
    const s = sessions[m[1]];
    let prompt = '';
    try { prompt = JSON.parse(await readBody(req)).prompt.text || ''; } catch (e) {}
    s.msgs.push({ type: 'user', content: [{ type: 'text', text: prompt }] });
    const reply = CANNED[s.n++ % CANNED.length];
    setTimeout(() => {
      s.msgs.push({ type: 'assistant', content: [{ type: 'text', text: reply }] });
    }, 1200);
    return sendJson(res, {});
  }
  m = u.pathname.match(/^\/api\/session\/([^/]+)\/message$/);
  if (req.method === 'GET' && m && sessions[m[1]]) {
    return sendJson(res, { data: sessions[m[1]].msgs });
  }
  if (req.method === 'POST' && u.pathname === '/api/search') {
    const raw = await readBody(req);
    const q = (raw.match(/(?:^|&)q=([^&]*)/) || [])[1] || '';
    const html = await ddgHtml(decodeURIComponent(q.replace(/\+/g, ' ')));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // --- static ---
  let p = decodeURIComponent(u.pathname);
  if (p === '/') p = '/index.html';
  const f = path.normalize(path.join(ROOT, p));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); return res.end('nope'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  fs.writeFileSync(path.join(__dirname, 'server.pid'), String(process.pid));
  console.log('web jalan: http://127.0.0.1:' + PORT + ' (pid ' + process.pid + ')');
});
