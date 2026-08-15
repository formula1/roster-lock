import * as os from "os";
import * as path from "path";
import { ProcessGroup, runToCompletion, waitForHttpOk } from "../../../integration/src/lib/process-utils";
import { installGameRunnerPlugin, setGameRunnerSettings } from "../../../integration/src/lib/matchAgentGameRunner";
import { copyIkemenInstall } from "../../../integration/src/lib/ikemenInstall";
import { REPO_ROOT } from "../../../integration/src/constants";

const IKEMEN_PLUGIN_NAME = "@roster-lock/game-runner-ikemen-go";

// Same set run.ts installs - dl-protocol/dl-archive plugins so
// downloadToFolder can actually fetch+extract a piece's .tar over http://,
// plus the untrusted script/config runtimes and the game runner itself.
const REQUIRED_PLUGINS = [
  "plugins/untrusted/script/ts", "plugins/untrusted/config/json",
  "plugins/download/protocol/http", "plugins/download/archive/tar",
  "plugins/game-runner/ikemen-go",
];

export type PlayerMatchAgent = {
  label: string,
  url: string,
  authCode: string,
  binaryLocation: string,
};

// match-agent spawns Ikemen as its own child, inheriting whatever
// environment launched match-agent itself - fine normally, but this suite
// is typically run from inside an IDE's own snap-packaged terminal (e.g.
// VS Code's snap build), whose GTK/GIO/pixbuf module-path env vars get
// picked up by Ikemen's (transitive) libgtk-3 dependency and load a
// mismatched snap-bundled libstdc++/libpthread over the system ones -
// confirmed by hand: the same binary copy runs fine under `env -i`, and
// crashes (exit 127) with a libpthread symbol-lookup error when these vars
// are inherited. Stripping them here, rather than in the ikemen-go plugin
// itself, since a real deployment's match-agent won't be launched from a
// snap-sandboxed terminal in the first place - this is dev-environment
// hygiene for this suite, not a product fix.
function cleanSpawnEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("SNAP") || (env[key] ?? "").includes("/snap/")) delete env[key];
  }
  return env;
}

/** Builds match-agent once - shared by every simulated player's own process. */
export async function buildMatchAgent(): Promise<void> {
  const exit = await runToCompletion(
    "build-match-agent", "pnpm", ["--filter", "@roster-lock/match-agent", "run", "build"], { cwd: REPO_ROOT }
  );
  if (exit !== 0) throw new Error("Failed to build match-agent");
}

/**
 * Starts one match-agent process for one simulated player - each player
 * gets its own process/port/piece+plugin folders (unlike run.ts's single
 * shared match-agent), matching a real deployment where match-agent never
 * spans more than one physical machine. Installs the plugins the ikemen-go
 * flow needs and points its binaryLocation at this player's own copy of the
 * Ikemen install (two real Ikemen processes sharing one install directory
 * corrupt each other's save/config state - see copyIkemenInstall).
 */
export async function startPlayerMatchAgent(
  processes: ProcessGroup, label: string, port: number, authCode: string, originalBinaryLocation: string
): Promise<PlayerMatchAgent> {
  const piecesFolder = processes.mkTempDir(path.join(os.tmpdir(), `roster-lock-mugen-pw-${label}-pieces-`));
  const pluginFolder = processes.mkTempDir(path.join(os.tmpdir(), `roster-lock-mugen-pw-${label}-plugins-`));
  const url = `http://localhost:${port}`;

  processes.spawnBackground(
    `match-agent-${label}`, process.execPath,
    [
      path.join(REPO_ROOT, "core/match-agent/dist/index.js"),
      "listen",
      "--port", String(port),
      "--auth-code", authCode,
      "--piece-folder", piecesFolder,
      "--plugin-folder", pluginFolder,
    ],
    { env: cleanSpawnEnv() }
  );
  await waitForHttpOk(url, 15_000);

  for (const pluginPath of REQUIRED_PLUGINS) {
    await installGameRunnerPlugin(url, authCode, path.join(REPO_ROOT, pluginPath));
  }

  const binaryLocation = await copyIkemenInstall(processes, label, originalBinaryLocation);
  await setGameRunnerSettings(url, authCode, IKEMEN_PLUGIN_NAME, { binaryLocation });

  return { label, url, authCode, binaryLocation };
}
