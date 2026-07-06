const http          = require('http');
const fs            = require('fs');
const path          = require('path');
const { execSync }  = require('child_process');
const WebTorrent    = require('webtorrent');
const createTorrent = require('create-torrent');

const FILES_DIR    = '/fixtures';
const WEBSEED_BASE = process.env.WEBSEED_BASE_URL || 'http://localhost:19001';
const ARCHIVE_GZ   = path.join(FILES_DIR, 'archive.tar.gz');
const ARCHIVE_TAR  = path.join(FILES_DIR, 'archive.tar');

// Create fixture files
fs.mkdirSync(path.join(FILES_DIR, 'subdir'), { recursive: true });
fs.writeFileSync(path.join(FILES_DIR, 'sample.txt'),         'Hello, World!\n');
fs.writeFileSync(path.join(FILES_DIR, 'subdir', 'data.txt'), 'Integration test data\n');
execSync(`tar czf ${ARCHIVE_GZ}  -C ${FILES_DIR} sample.txt subdir/`);
execSync(`tar cf  ${ARCHIVE_TAR} -C ${FILES_DIR} sample.txt subdir/`);

const magnets = { file: null, 'file-tar': null, dir: null };
const client  = new WebTorrent();

// Single-file torrent: archive.tar.gz
createTorrent(ARCHIVE_GZ, { urlList: [`${WEBSEED_BASE}/archive.tar.gz`] }, (err, buf) => {
  if (err) { console.error(err); process.exit(1); }
  client.seed(ARCHIVE_GZ, { torrent: buf }, (t) => {
    magnets.file = t.magnetURI;
    console.log('Seeding file torrent:', magnets.file);
  });
});

// Single-file torrent: archive.tar
createTorrent(ARCHIVE_TAR, { urlList: [`${WEBSEED_BASE}/archive.tar`] }, (err, buf) => {
  if (err) { console.error(err); process.exit(1); }
  client.seed(ARCHIVE_TAR, { torrent: buf }, (t) => {
    magnets['file-tar'] = t.magnetURI;
    console.log('Seeding file-tar torrent:', magnets['file-tar']);
  });
});

// Multi-file torrent: sample.txt + subdir/data.txt
const multiFiles = [
  path.join(FILES_DIR, 'sample.txt'),
  path.join(FILES_DIR, 'subdir', 'data.txt'),
];
createTorrent(multiFiles, { urlList: [`${WEBSEED_BASE}/`] }, (err, buf) => {
  if (err) { console.error(err); process.exit(1); }
  client.seed(multiFiles, { torrent: buf }, (t) => {
    magnets.dir = t.magnetURI;
    console.log('Seeding dir torrent:', magnets.dir);
  });
});

// HTTP: /magnet/file, /magnet/dir — plus static file serving for webseed
http.createServer((req, res) => {
  if (req.url === '/magnet/file' || req.url === '/magnet/file-tar' || req.url === '/magnet/dir') {
    const key = req.url.slice(8); // 'file', 'file-tar', or 'dir'
    if (!magnets[key]) { res.writeHead(503); res.end('not ready'); return; }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(magnets[key]);
    return;
  }
  // Keep /magnet backwards-compatible (defaults to file)
  if (req.url === '/magnet') {
    if (!magnets.file) { res.writeHead(503); res.end('not ready'); return; }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(magnets.file);
    return;
  }
  res.writeHead(404); res.end();
}).listen(19000, () => console.log('Torrent info server on :19000'));

// Webseed HTTP server — serves individual files from FILES_DIR
http.createServer((req, res) => {
  const filePath = path.join(FILES_DIR, decodeURIComponent(req.url));
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200);
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404); res.end();
  }
}).listen(19001, () => console.log('Webseed HTTP server on :19001'));
