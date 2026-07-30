import { spawn, ChildProcess, SpawnOptions } from "child_process";
import * as fs from "fs";

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
 * orchestration script (run.ts, run-game.ts) owns exactly one of these.
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
