import * as os from "os";
import * as path from "path";
import { cp } from "fs/promises";
import { ProcessGroup } from "./process-utils";

/**
 * Copies a local Ikemen GO install into a fresh temp directory and returns
 * the copy's binary path. Two real Ikemen processes sharing one install
 * directory write to its save/config files concurrently - confirmed by hand
 * this isn't just a soft "failed to connect" netplay failure, it can crash
 * the process outright; copies of the folder run separately don't have
 * either problem. The plugin itself also relies on this: it runs Ikemen
 * with cwd set to `dirname(binaryLocation)` (see
 * plugins/game-runner/ikemen-go/src/startGame/index.ts - Ikemen resolves
 * data/save/external relative to cwd, not its own executable), so a fresh
 * copy per player is also what gives each process its own unique cwd, not
 * just its own binary path. Every simulated player needs its own copy of
 * whatever install `--binary-location`/`IKEMEN_BINARY_LOCATION` points at.
 */
export async function copyIkemenInstall(
  processes: ProcessGroup, label: string, originalBinaryLocation: string
): Promise<string> {
  const sourceDir = path.dirname(originalBinaryLocation);
  const destDir = processes.mkTempDir(path.join(os.tmpdir(), `roster-lock-mugen-ikemen-${label}-`));
  await cp(sourceDir, destDir, { recursive: true });
  return path.join(destDir, path.basename(originalBinaryLocation));
}
