import * as os from "os";
import * as path from "path";
import { cp } from "fs/promises";
import { ProcessGroup } from "./process-utils";

/**
 * Copies a local Ikemen GO install into a fresh temp directory and returns
 * the copy's folder - what binaryLocation means now (see
 * docs/v2/binary-location.md): a folder with the actual binary at its root,
 * not a path to the binary itself. `--binary-location`/`IKEMEN_BINARY_LOCATION`
 * still names the executable directly (e.g.
 * ~/Games/Ikemen-GO-1.0.0-rc.2/Ikemen_GO_Linux) since that's what
 * unambiguously identifies both "which install" and its containing folder;
 * the copy keeps the executable under its original (official) name, which
 * is exactly what ikemen-go's resolveIkemenBinary
 * (plugins/game-runner/ikemen-go/src/binaryLocation.ts) looks for at the
 * folder's root, so no renaming is needed here.
 *
 * Two real Ikemen processes sharing one install directory write to its
 * save/config files concurrently - confirmed by hand this isn't just a soft
 * "failed to connect" netplay failure, it can crash the process outright;
 * copies of the folder run separately don't have either problem. The
 * plugin itself also relies on this: it runs Ikemen with cwd set to the
 * resolved binary's dirname (see
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
  return destDir;
}
