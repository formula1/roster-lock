import { spawn, ChildProcess, SpawnOptions } from "child_process";
import * as fs from "fs";

// match-agent spawns Ikemen as its own child, inheriting whatever environment launched
// match-agent itself - fine normally, but this repo is often run from inside an IDE's own
// snap-packaged terminal (e.g. VS Code's snap build), whose GTK/GIO/pixbuf module-path env vars
// get picked up by Ikemen's (transitive) libgtk-3 dependency and load a mismatched snap-bundled
// libstdc++/libpthread over the system ones - confirmed by hand: the same binary copy runs fine
// under `env -i`, and crashes (exit 127) with a libpthread symbol-lookup error when these vars
// are inherited. Stripping them here, rather than in the ikemen-go plugin itself, since a real
// deployment's match-agent won't be launched from a snap-sandboxed terminal in the first place -
// this is dev-environment hygiene for scripts that spawn match-agent, not a product fix. Used by
// both run.ts's own match-agent spawn and examples/mugen/playwright's matchAgentProcess.ts.
export function cleanSpawnEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("SNAP") || (env[key] ?? "").includes("/snap/")) delete env[key];
  }
  return env;
}

export function log(prefix: string, message: string){
  for(const line of message.split("\n")){
    if(line.length === 0) continue;
    console.log(`[${prefix}] ${line}`);
  }
}

export function runToCompletion(
  prefix: string, command: string, args: string[], options: SpawnOptions = {}
): Promise<number> {
  return new Promise((resolve, reject)=>{
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    child.stdout?.on("data", (data)=>log(prefix, data.toString()));
    child.stderr?.on("data", (data)=>log(prefix, data.toString()));
    child.on("error", reject);
    child.on("exit", (code)=>resolve(code ?? 1));
  });
}

export function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolve)=>{
    child.on("exit", (code)=>resolve(code ?? 1));
  });
}

export async function waitForHttpOk(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while(Date.now() - start < timeoutMs){
    try {
      const response = await fetch(url);
      if(response.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise(resolve=>setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url} to become ready`);
}

/**
 * Tracks background child processes and temp directories for a single CLI
 * run, so success/failure/SIGINT/SIGTERM all clean up the same way. Each
 * orchestration script (run.ts) owns exactly one of these.
 */
export class ProcessGroup {
  private children: ChildProcess[] = [];
  private tempDirs: string[] = [];
  private cleanedUp = false;

  spawnBackground(prefix: string, command: string, args: string[], options: SpawnOptions = {}): ChildProcess {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...options });
    child.stdout?.on("data", (data)=>log(prefix, data.toString()));
    child.stderr?.on("data", (data)=>log(prefix, data.toString()));
    this.children.push(child);
    return child;
  }

  mkTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(prefix);
    this.tempDirs.push(dir);
    return dir;
  }

  registerCleanupOnSignals(onCleanup?: ()=>Promise<unknown>){
    process.on("SIGINT", async ()=>{ await this.cleanup(onCleanup); process.exit(1); });
    process.on("SIGTERM", async ()=>{ await this.cleanup(onCleanup); process.exit(1); });
    // A throw inside an event-emitter callback (e.g. a stream "data" handler) or a
    // rejected promise nobody awaited bypasses the calling script's try/catch entirely,
    // so without these the tracked child processes would be silently orphaned.
    process.on("uncaughtException", async (err)=>{
      console.error("Uncaught exception:", err);
      await this.cleanup(onCleanup);
      process.exit(1);
    });
    process.on("unhandledRejection", async (err)=>{
      console.error("Unhandled rejection:", err);
      await this.cleanup(onCleanup);
      process.exit(1);
    });
  }

  /** onCleanup runs after children are killed but before temp dirs are removed. */
  async cleanup(onCleanup?: ()=>Promise<unknown>){
    if(this.cleanedUp) return;
    this.cleanedUp = true;
    console.log("\nCleaning up...");
    for(const child of this.children){
      if(child.exitCode === null && !child.killed) child.kill("SIGTERM");
    }
    if(onCleanup) await onCleanup().catch(()=>{});
    for(const dir of this.tempDirs){
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}
