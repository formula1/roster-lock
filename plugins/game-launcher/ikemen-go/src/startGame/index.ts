import { GameLauncherPlugin } from "@roster-lock/types";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { openSync } from "node:fs";
import { buildIkemenArgs, IkemenGameConfig } from "./buildArgs";
import { toProcessHandle } from "./processHandle";
import { resolveIkemenBinary } from "../binaryLocation";

export { IkemenGameConfig };

export const startGame: GameLauncherPlugin<IkemenGameConfig>["startGame"] = async(
  binaryLocation, target, connectionConfig, args
)=>{
  // Resolving a direct-tcp room's addresses (coordinator handshake, NAT/LAN
  // preference, etc.) is match-agent's job (plugin-runtime's
  // GameLauncher.startGame), not this plugin's - by the time startGame is
  // called, connectionConfig.hostIp (client) is already the address to dial,
  // and a host has nothing left to resolve at all.
  const cliArgs = buildIkemenArgs(connectionConfig, args);
  const resolvedPath = resolveIkemenBinary(binaryLocation, target);

  // Ikemen resolves data/, external/ and save/ relative to the working
  // directory, not to its own executable - on Linux it only chdirs for
  // Android and macOS app bundles (src/main.go, src/system.go). Without this
  // it dies on "external/script/main.lua: no such file or directory" wherever
  // match-agent happened to be started from.
  const cwd = dirname(resolvedPath);
  // Captured rather than ignored - Ikemen's own stdout/stderr is the only
  // way to see *why* a netplay connection failed (timeout, version
  // mismatch, etc.) instead of just observing a black/frozen window with no
  // diagnostic. Written into cwd, which is already unique per process (see
  // examples/mugen/integration - each simulated player gets its own copy of
  // the install), so two instances never share this file either.
  const stdout = openSync(join(cwd, "roster-lock-ikemen-stdout.log"), "a");
  const stderr = openSync(join(cwd, "roster-lock-ikemen-stderr.log"), "a");
  const child = spawn(resolvedPath, cliArgs, {
    cwd,
    detached: true,
    stdio: ["ignore", stdout, stderr],
  });
  // Detached + unref so the launching process (match-agent, or whatever
  // called startGame) doesn't have to stay alive for Ikemen to keep running.
  child.unref();

  return toProcessHandle(child);
}
