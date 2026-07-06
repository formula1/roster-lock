const http  = require('http');
const { spawn } = require('child_process');

const REPO = '/repo';

// pkt-line: 4-hex-digit length (including the 4 digits) + data
function pktLine(s) {
  const len = (s.length + 4).toString(16).padStart(4, '0');
  return len + s;
}
const FLUSH = '0000';

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname.endsWith('/info/refs')) {
    const service = url.searchParams.get('service');
    if (service !== 'git-upload-pack') { res.writeHead(403); res.end(); return; }

    res.writeHead(200, {
      'Content-Type': 'application/x-git-upload-pack-advertisement',
      'Cache-Control': 'no-cache',
    });
    res.write(pktLine(`# service=${service}\n`) + FLUSH);
    const proc = spawn('git-upload-pack', ['--stateless-rpc', '--advertise-refs', REPO]);
    proc.stdout.pipe(res);
    proc.stderr.pipe(process.stderr);
    return;
  }

  if (req.method === 'POST' && url.pathname.endsWith('/git-upload-pack')) {
    res.writeHead(200, { 'Content-Type': 'application/x-git-upload-pack-result' });
    const proc = spawn('git-upload-pack', ['--stateless-rpc', REPO]);
    req.pipe(proc.stdin);
    proc.stdout.pipe(res);
    proc.stderr.pipe(process.stderr);
    return;
  }

  res.writeHead(404); res.end();
}).listen(3000, () => console.log('Git HTTP server on :3000'));
