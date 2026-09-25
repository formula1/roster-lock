import { GameLauncherPlugin } from "@roster-lock/types";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { openSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { buildIkemenArgs, IkemenGameConfig } from "./buildArgs";
import { toProcessHandle } from "./processHandle";
import { resolveIkemenBinary } from "../binaryLocation";
import { resolveOfficialTeamMode } from "../selectionValidation";
import { resolveGameEndedResult } from "./gameResult";

export { IkemenGameConfig };

export const startGame: GameLauncherPlugin<IkemenGameConfig>["startGame"] = async(
  binaryLocation, target, connectionConfig, args
)=>{
  // Resolving a direct-tcp room's addresses (coordinator handshake, NAT/LAN
  // preference, etc.) is match-agent's job (plugin-runtime's
  // GameLauncher.startGame), not this plugin's - by the time startGame is
  // called, connectionConfig.hostIp (client) is already the address to dial,
  // and a host has nothing left to resolve at all.
  const officialTeamMode = await resolveOfficialTeamMode(args.rosterConfig);
  const resolvedPath = resolveIkemenBinary(binaryLocation, target);

  // Ikemen resolves data/, external/ and save/ relative to the working
  // directory, not to its own executable - on Linux it only chdirs for
  // Android and macOS app bundles (src/main.go, src/system.go). Without this
  // it dies on "external/script/main.lua: no such file or directory" wherever
  // match-agent happened to be started from.
  const cwd = dirname(resolvedPath);
  // A fresh OS temp dir per spawn, not cwd - binaryLocation (and so cwd,
  // which is just its dirname) is an ordinary match-agent-wide setting with
  // no guarantee of being unique per process (only examples/mugen/integration's
  // test harness happens to give each simulated player its own install copy).
  // Two real matches sharing one install would otherwise clobber each other's
  // files here - merely confusing for stdout/stderr, but silently wrong for
  // the result log below (reading back the other match's WinSide).
  const runDir = mkdtempSync(join(tmpdir(), "roster-lock-ikemen-"));
  // Captured rather than ignored - Ikemen's own stdout/stderr is the only
  // way to see *why* a netplay connection failed (timeout, version
  // mismatch, etc.) instead of just observing a black/frozen window with no
  // diagnostic.
  const stdout = openSync(join(runDir, "stdout.log"), "a");
  const stderr = openSync(join(runDir, "stderr.log"), "a");
  // Ikemen's own -log end-of-match result dump (WinSide etc.), read back
  // below once the process exits to report a result via args.gameEnded.
  const logFile = join(runDir, "result-log.txt");
  const cliArgs = buildIkemenArgs(connectionConfig, args, officialTeamMode, logFile);
  const child = spawn(resolvedPath, cliArgs, {
    cwd,
    detached: true,
    stdio: ["ignore", stdout, stderr],
  });
  // Detached + unref so the launching process (match-agent, or whatever
  // called startGame) doesn't have to stay alive for Ikemen to keep running.
  child.unref();

  const handle = toProcessHandle(child);
  handle.onExit(async ()=>{
    try {
      const result = await resolveGameEndedResult(logFile, args);
      if(result) args.gameEnded(result);
    } catch(e){
      // The log may not exist at all if Ikemen crashed before writing it -
      // best-effort, same as the rest of this plugin's process lifecycle.
      console.error(`ikemen-go: couldn't determine match result from "${logFile}"`, e);
    }
  });

  return handle;
}
