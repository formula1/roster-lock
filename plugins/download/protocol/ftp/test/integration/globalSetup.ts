import { execSync } from 'node:child_process';
import { createConnection } from 'node:net';
import path from 'node:path';

const COMPOSE_FILE = path.join(__dirname, 'docker-compose.yml');

function compose(args: string) {
  execSync(`docker compose -f ${COMPOSE_FILE} ${args}`, { stdio: 'inherit' });
}

function waitForTcp(host: string, port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const sock = createConnection({ host, port }, () => { sock.destroy(); resolve(); });
      sock.on('error', () => {
        sock.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
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
  await waitForTcp('localhost', 12021, 30_000);
}

export async function teardown() {
  compose('down');
}
