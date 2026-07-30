import { execSync } from 'node:child_process';
import path from 'node:path';

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

export async function setup() {
  compose('up -d --build');
  await waitForHttp('http://localhost:18080/archive.tar.gz', 30_000);
}

export async function teardown() {
  compose('down');
}
