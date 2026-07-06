import { createServer }                          from 'node:http';
import { mkdirSync, writeFileSync,
         createReadStream, existsSync, statSync } from 'node:fs';
import path                                       from 'node:path';
import { execSync }                               from 'node:child_process';
import { promisify }                              from 'node:util';
import WebTorrent                                 from 'webtorrent';
import createTorrent                              from 'create-torrent';

const FILES_DIR    = '/fixtures';
const WEBSEED_BASE = process.env.WEBSEED_BASE_URL || 'http://localhost:19001';
const PEER_PORT    = 19002;

// ── create fixtures ───────────────────────────────────────────────────────────
mkdirSync(path.join(FILES_DIR, 'subdir'), { recursive: true });
writeFileSync(path.join(FILES_DIR, 'sample.txt'),         'Hello, World!\n');
writeFileSync(path.join(FILES_DIR, 'subdir', 'data.txt'), 'Integration test data\n');
// archives: contain sample.txt and subdir/ at root (no fixtures/ prefix)
execSync(`tar czf ${FILES_DIR}/archive.tar.gz -C ${FILES_DIR} sample.txt subdir/`);
execSync(`tar cf  ${FILES_DIR}/archive.tar    -C ${FILES_DIR} sample.txt subdir/`);

// ── seeder ────────────────────────────────────────────────────────────────────
// dht/lsd/tracker off — leecher finds us via x.pe peer hint in the magnet URI
const client = new WebTorrent({ dht: false, lsd: false, tracker: false, torrentPort: PEER_PORT });
client.on('error', err => { console.error('WebTorrent error:', err); process.exit(1); });

const ct = promisify(createTorrent);

async function seedAndGetMagnet(input, webseedUrl) {
  const buf = await ct(input, { urlList: [webseedUrl] });
  return new Promise((resolve, reject) => {
    client.seed(input, { torrent: buf }, torrent => {
      // Append x.pe so the leecher connects directly to the seeder port
      resolve(`${torrent.magnetURI}&x.pe=localhost%3A${PEER_PORT}`);
    });
  });
}

// Single-file torrents: webseed URL is the direct file path under FILES_DIR
// Multi-file torrent:   webseed base is FILES_DIR parent so webconn appends fixtures/...
const [magnetFile, magnetFileTar] = await Promise.all([
  seedAndGetMagnet(`${FILES_DIR}/archive.tar.gz`, `${WEBSEED_BASE}/fixtures/archive.tar.gz`),
  seedAndGetMagnet(`${FILES_DIR}/archive.tar`,    `${WEBSEED_BASE}/fixtures/archive.tar`),
]);

const multiFiles = [
  path.join(FILES_DIR, 'sample.txt'),
  path.join(FILES_DIR, 'subdir', 'data.txt'),
];
const bufDir   = await ct(multiFiles, { urlList: [`${WEBSEED_BASE}/`] });
const magnetDir = await new Promise((resolve, reject) => {
  client.seed(multiFiles, { torrent: bufDir }, torrent => {
    resolve(`${torrent.magnetURI}&x.pe=localhost%3A${PEER_PORT}`);
  });
});

console.log('file:    ', magnetFile);
console.log('file-tar:', magnetFileTar);
console.log('dir:     ', magnetDir);

const magnets = { file: magnetFile, 'file-tar': magnetFileTar, dir: magnetDir };

// ── API server ────────────────────────────────────────────────────────────────
// Starts only after all magnets are ready — waitForHttp will see 200 immediately
createServer((req, res) => {
  if (req.url?.startsWith('/magnet/')) {
    const key = req.url.slice(8);
    if (magnets[key]) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(magnets[key]);
    } else {
      res.writeHead(404); res.end('not found');
    }
    return;
  }
  res.writeHead(404); res.end();
}).listen(19000, () => console.log('API server on :19000'));

// ── webseed HTTP server ───────────────────────────────────────────────────────
// Serve from filesystem root so both /fixtures/archive.tar.gz and /fixtures/sample.txt work
createServer((req, res) => {
  const filePath = path.join('/', decodeURIComponent(req.url || '/'));
  if (existsSync(filePath) && statSync(filePath).isFile()) {
    res.writeHead(200);
    createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404); res.end();
  }
}).listen(19001, () => console.log('Webseed server on :19001'));
