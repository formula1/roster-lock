import * as os from "os";
import * as path from "path";
import { cp, readFile, writeFile } from "fs/promises";
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
 * (plugins/game-launcher/ikemen-go/src/binaryLocation.ts) looks for at the
 * folder's root, so no renaming is needed here.
 *
 * Two real Ikemen processes sharing one install directory write to its
 * save/config files concurrently - confirmed by hand this isn't just a soft
 * "failed to connect" netplay failure, it can crash the process outright;
 * copies of the folder run separately don't have either problem. The
 * plugin itself also relies on this: it runs Ikemen with cwd set to the
 * resolved binary's dirname (see
 * plugins/game-launcher/ikemen-go/src/startGame/index.ts - Ikemen resolves
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

/**
 * Overrides save/config.ini's WindowWidth/WindowHeight/WindowCentered for one player's copy of
 * the install - opt-in (see run.ts's IKEMEN_DEMO_LAYOUT), not part of the normal test flow.
 *
 * The default WindowWidth/WindowHeight = 0 (defers to GameWidth/GameHeight) produces a window
 * whose WM_NORMAL_HINTS reports a stale, degenerate "10x10" fixed size - confirmed by hand via
 * xprop - which blocks every WM-level move/resize/tile operation (Mutter correctly refuses to
 * touch a window that's declared itself fixed-size, even though what's on screen is clearly
 * larger). A window launched with explicit non-zero WindowWidth/WindowHeight instead reports
 * correct hints from the start and _NET_WM_ACTION_MOVE/_NET_WM_ACTION_RESIZE in its allowed
 * actions - xdotool windowmove then works normally. This has to happen before Ikemen's first
 * window-creation call, i.e. by editing config on disk before spawning, not by resizing after -
 * these are two different code paths inside Ikemen/GLFW, not the same thing done at two times.
 */
export async function setIkemenWindowSize(installDir: string, width: number, height: number): Promise<void> {
  const configPath = path.join(installDir, "save/config.ini");
  const config = await readFile(configPath, "utf-8");
  const patched = config
    .replace(/^WindowWidth(\s*)=.*/m, `WindowWidth$1= ${width}`)
    .replace(/^WindowHeight(\s*)=.*/m, `WindowHeight$1= ${height}`)
    .replace(/^WindowCentered(\s*)=.*/m, `WindowCentered$1= 0`);
  await writeFile(configPath, patched);
}
