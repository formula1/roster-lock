import { createServer }                          from 'node:http';
import { mkdirSync, writeFileSync,
         createReadStream, existsSync, statSync } from 'node:fs';
import path                                       from 'node:path';
import { execSync }                               from 'node:child_process';
import WebTorrent                                 from 'webtorrent';

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

// Dedicated dir for the multi-file torrent: create-torrent only preserves
// subdir/ nesting when given a real directory to traverse. Feeding it an
// array of individual file paths instead makes it treat the first file's
// basename as the torrent's folder name (a create-torrent quirk), which
// flattens/corrupts the structure — so we seed a real directory here.
const MULTI_DIR = path.join(FILES_DIR, 'multifile');
mkdirSync(path.join(MULTI_DIR, 'subdir'), { recursive: true });
writeFileSync(path.join(MULTI_DIR, 'sample.txt'),         'Hello, World!\n');
writeFileSync(path.join(MULTI_DIR, 'subdir', 'data.txt'), 'Integration test data\n');

// ── seeder ────────────────────────────────────────────────────────────────────
// dht/lsd/tracker off — leecher finds us via x.pe peer hint in the magnet URI
const client = new WebTorrent({ dht: false, lsd: false, tracker: false, torrentPort: PEER_PORT });
client.on('error', err => { console.error('WebTorrent error:', err); process.exit(1); });

// client.seed() builds its own torrent internally (any pre-built `torrent`
// buffer passed in opts is ignored), so announceList/private have to be set
// here — this is what actually keeps public trackers out of the magnet URI
// and marks the torrent private so leechers skip DHT/PEX for it.
function seedAndGetMagnet(input, webseedUrl) {
  return new Promise((resolve, reject) => {
    client.seed(input, { urlList: [webseedUrl], announceList: [], private: true }, torrent => {
      // Append x.pe so the leecher connects directly to the seeder port.
      // webtorrent's magnet parser reads this value raw (no percent-decoding),
      // so the colon must NOT be percent-encoded or the peer hint is silently
      // discarded as invalid.
      resolve(`${torrent.magnetURI}&x.pe=localhost:${PEER_PORT}`);
    });
  });
}

// Single-file torrents: webseed URL is the direct file path under FILES_DIR
// Multi-file torrent:   webseed base is FILES_DIR parent so webconn appends fixtures/...
const [magnetFile, magnetFileTar] = await Promise.all([
  seedAndGetMagnet(`${FILES_DIR}/archive.tar.gz`, `${WEBSEED_BASE}/fixtures/archive.tar.gz`),
  seedAndGetMagnet(`${FILES_DIR}/archive.tar`,    `${WEBSEED_BASE}/fixtures/archive.tar`),
]);

const magnetDir = await seedAndGetMagnet(MULTI_DIR, `${WEBSEED_BASE}/fixtures/`);

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
