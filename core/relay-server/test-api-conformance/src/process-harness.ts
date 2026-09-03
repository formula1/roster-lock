import { spawn, ChildProcess } from "child_process";
import { createServer } from "net";
import { RelayHarness, RelayHarnessConfig } from "./harness.js";

export type ProcessHarnessOptions = {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  // Run before the process is spawned (e.g. applying a schema migration to
  // a fresh local DB). Optional since not every implementation needs one.
  beforeSpawn?: () => Promise<void>;
  // Run after the process has exited (e.g. removing a temp persistence
  // dir created for beforeSpawn). Optional, same as beforeSpawn.
  afterStop?: () => Promise<void>;
  // Path polled (as a plain GET) until it responds at all - any HTTP
  // response, even a 404, proves the process is up and routing requests.
  readyPath?: string;
  timeoutMs?: number;
};

// Every relay-server implementation so far (and the redis/postgres-backed
// one that prompted this suite) is "a process that listens on a port and
// speaks the relay HTTP/WS protocol" - so the process-management part of a
// RelayHarness is identical across all of them. Adapters just describe how
// to spawn *their* process; this handles picking a port, spawning it,
// waiting for it to come up, and tearing it down.
export function createProcessHarness(
  build: (port: number, config: RelayHarnessConfig) => ProcessHarnessOptions,
): RelayHarness {
  let child: ChildProcess | null = null;
  let afterStop: (() => Promise<void>) | undefined;

  return {
    async start(config: RelayHarnessConfig) {
      const port = await getFreePort();
      const options = build(port, config);
      afterStop = options.afterStop;

      await options.beforeSpawn?.();

      child = spawn(options.command, options.args, {
        cwd: options.cwd,
        env: options.env,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let output = "";
      child.stdout?.on("data", (chunk) => { output += chunk.toString(); });
      child.stderr?.on("data", (chunk) => { output += chunk.toString(); });
      child.on("error", (err) => { output += `\n[spawn error] ${err.message}`; });

      const baseUrl = `http://localhost:${port}`;
      await waitUntilReady(
        `${baseUrl}${options.readyPath ?? "/"}`,
        options.timeoutMs ?? 30_000,
        () => output,
      );
      return { baseUrl };
    },

    async stop() {
      const current = child;
      child = null;
      if (current && current.exitCode === null) {
        const exited = new Promise<void>((resolve) => current.once("exit", () => resolve()));
        current.kill();
        await exited;
      }
      await afterStop?.();
    },
  };
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("Could not determine a free port")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function waitUntilReady(url: string, timeoutMs: number, getOutput: () => string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await fetch(url);
      return;
    } catch (e) {
      lastError = e;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(
    `Server never became ready at ${url} within ${timeoutMs}ms.\n` +
    `Last error: ${String(lastError)}\n` +
    `Process output:\n${getOutput()}`,
  );
}
