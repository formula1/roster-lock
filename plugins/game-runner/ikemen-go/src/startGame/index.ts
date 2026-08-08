import { GameRunnerPlugin } from "@roster-lock/types";
import { spawn } from "node:child_process";
import { dirname } from "node:path";
import { buildIkemenArgs } from "./buildArgs";
import { toProcessHandle } from "./processHandle";

export const startGame: GameRunnerPlugin["startGame"] = async(
  binaryLocation, connectionConfig, args
)=>{
  const cliArgs = buildIkemenArgs(connectionConfig, args);

  // Ikemen resolves data/, external/ and save/ relative to the working
  // directory, not to its own executable - on Linux it only chdirs for
  // Android and macOS app bundles (src/main.go, src/system.go). Without this
  // it dies on "external/script/main.lua: no such file or directory" wherever
  // match-agent happened to be started from.
  const child = spawn(binaryLocation, cliArgs, {
    cwd: dirname(binaryLocation),
    detached: true,
    stdio: "ignore",
  });
  // Detached + unref so the launching process (match-agent, or whatever
  // called startGame) doesn't have to stay alive for Ikemen to keep running.
  child.unref();

  return toProcessHandle(child);
}
