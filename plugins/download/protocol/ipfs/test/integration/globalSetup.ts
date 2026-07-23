import { execSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { FIXTURE_FILES } from '@roster-lock/dl-shared/test';

const COMPOSE_FILE = path.join(__dirname, 'docker-compose.yml');

function compose(args: string) {
  execSync(`docker compose -f ${COMPOSE_FILE} ${args}`, { stdio: 'inherit' });
}

function waitForHttp(url: string, timeoutMs: number, method: string = 'GET'): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      fetch(url, { method, signal: AbortSignal.timeout(3000) })
        .then(res => { if (res.ok) resolve(); else throw new Error(`HTTP ${res.status}`); })
        .catch(() => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`Timed out waiting for ${url}`));
            return;
          }
          setTimeout(attempt, 1500);
        });
    };
    attempt();
  });
}

// Wraps the file in a directory so the returned CID is path-addressable
// (ipfs://<CID>/<filename>) — a bare, un-wrapped file CID carries no
// filename anywhere in its DAG, which is exactly the case the ipfs plugin
// now requires a name for.
async function addFileToIpfs(filePath: string, uploadName: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', new Blob([fs.readFileSync(filePath)]), uploadName);
  const res = await fetch(
    'http://127.0.0.1:5001/api/v0/add?wrap-with-directory=true',
    { method: 'POST', body: formData },
  );
  const lines = (await res.text()).trim().split('\n').map(l => JSON.parse(l));
  const wrapper = lines.find((l: any) => l.Name === '') ?? lines[lines.length - 1];
  return wrapper.Hash;
}

async function addDirToIpfs(files: Record<string, string>): Promise<string> {
  const formData = new FormData();
  for (const [rel, content] of Object.entries(files)) {
    formData.append('file', new Blob([content]), `fixtures/${rel}`);
  }
  const res = await fetch(
    'http://127.0.0.1:5001/api/v0/add?recursive=true',
    { method: 'POST', body: formData },
  );
  const lines = (await res.text()).trim().split('\n').map(l => JSON.parse(l));
  const dir = lines.find((l: any) => l.Name === 'fixtures') ?? lines[lines.length - 1];
  return dir.Hash;
}

function buildArchive(files: Record<string, string>, destPath: string, flags: string) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-ipfs-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(tmpDir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
    execSync(`tar ${flags} ${destPath} -C ${tmpDir} .`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function buildTarGz(files: Record<string, string>, destPath: string) { buildArchive(files, destPath, 'czf'); }
function buildTar(files: Record<string, string>, destPath: string)   { buildArchive(files, destPath, 'cf');  }

export async function setup() {
  compose('up -d --build');
  await waitForHttp('http://127.0.0.1:5001/api/v0/id', 120_000, 'POST');

  const tmpArchiveGz  = path.join(os.tmpdir(), 'rl-ipfs-archive.tar.gz');
  const tmpArchiveTar = path.join(os.tmpdir(), 'rl-ipfs-archive.tar');
  buildTarGz(FIXTURE_FILES, tmpArchiveGz);
  buildTar(FIXTURE_FILES, tmpArchiveTar);

  const [fileCid, fileTarCid] = await Promise.all([
    addFileToIpfs(tmpArchiveGz, 'archive.tar.gz'),
    addFileToIpfs(tmpArchiveTar, 'archive.tar'),
  ]);
  fs.unlinkSync(tmpArchiveGz);
  fs.unlinkSync(tmpArchiveTar);
  process.env.IPFS_FILE_CID     = fileCid;
  process.env.IPFS_FILE_TAR_CID = fileTarCid;
  console.log(`IPFS file CID:     ${fileCid}`);
  console.log(`IPFS file-tar CID: ${fileTarCid}`);

  const dirCid = await addDirToIpfs(FIXTURE_FILES);
  process.env.IPFS_DIR_CID = dirCid;
  console.log(`IPFS dir CID:  ${dirCid}`);
}

export async function teardown() {
  compose('down');
}
