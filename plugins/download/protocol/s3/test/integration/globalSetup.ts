import { execSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { S3Client, CreateBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { FIXTURE_FILES } from '@roster-lock/dl-shared/test';

const S3_ENDPOINT = 'http://localhost:19100';
const S3_BUCKET = 'roster-lock-test';

const COMPOSE_FILE = path.join(__dirname, 'docker-compose.yml');

function compose(args: string) {
  execSync(`docker compose -f ${COMPOSE_FILE} ${args}`, { stdio: 'inherit' });
}

function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      fetch(url, { signal: AbortSignal.timeout(3000) })
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

function buildArchive(files: Record<string, string>, destPath: string, flags: string) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-s3-'));
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

async function seedS3(tmpArchiveGz: string, tmpArchiveTar: string): Promise<void> {
  // These are also picked up by the S3 protocol plugin under test (via the
  // standard AWS SDK credential/region resolution chain) — only the
  // endpoint itself comes from the s3+http:// URL used in index.test.ts.
  process.env.AWS_ACCESS_KEY_ID = 'roster-lock-test';
  process.env.AWS_SECRET_ACCESS_KEY = 'roster-lock-test-secret';
  process.env.AWS_REGION = 'us-east-1';
  process.env.S3_TEST_BUCKET = S3_BUCKET;

  const client = new S3Client({ endpoint: S3_ENDPOINT, forcePathStyle: true, region: 'us-east-1' });
  await client.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
  await Promise.all([
    client.send(new PutObjectCommand({
      Bucket: S3_BUCKET, Key: 'archive.tar.gz', Body: fs.readFileSync(tmpArchiveGz),
    })),
    client.send(new PutObjectCommand({
      Bucket: S3_BUCKET, Key: 'archive.tar', Body: fs.readFileSync(tmpArchiveTar),
    })),
  ]);
  console.log(`S3 bucket seeded: ${S3_BUCKET}`);
}

export async function setup() {
  compose('up -d --build');
  await waitForHttp('http://localhost:19100/minio/health/live', 30_000);

  const tmpArchiveGz  = path.join(os.tmpdir(), 'rl-s3-archive.tar.gz');
  const tmpArchiveTar = path.join(os.tmpdir(), 'rl-s3-archive.tar');
  buildTarGz(FIXTURE_FILES, tmpArchiveGz);
  buildTar(FIXTURE_FILES, tmpArchiveTar);

  await seedS3(tmpArchiveGz, tmpArchiveTar);
  fs.unlinkSync(tmpArchiveGz);
  fs.unlinkSync(tmpArchiveTar);
}

export async function teardown() {
  compose('down');
}
