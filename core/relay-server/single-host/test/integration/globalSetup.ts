import { execSync } from "node:child_process";
import path from "node:path";
import { Redis } from "ioredis";

export const REDIS_URL = "redis://localhost:16379";

const COMPOSE_FILE = path.join(__dirname, "docker-compose.yml");

function compose(args: string) {
  execSync(`docker compose -f ${COMPOSE_FILE} ${args}`, { stdio: "inherit" });
}

async function waitForRedis(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    const client = new Redis(url, { lazyConnect: true, retryStrategy: () => null });
    client.on("error", () => {});
    try {
      await client.connect();
      await client.ping();
      await client.quit();
      return;
    } catch (e) {
      lastError = e;
      client.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`redis never became ready at ${url} within ${timeoutMs}ms.\nLast error: ${String(lastError)}`);
}

export async function setup() {
  compose("up -d");
  await waitForRedis(REDIS_URL, 30_000);
}

export async function teardown() {
  compose("down");
}
