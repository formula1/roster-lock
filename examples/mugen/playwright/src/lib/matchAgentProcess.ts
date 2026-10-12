import * as os from "os";
import * as path from "path";
import { ProcessGroup, runToCompletion, waitForHttpOk, cleanSpawnEnv } from "../../../integration/src/lib/process-utils";
import { installGameLauncherPlugin, setGameLauncherSettings } from "../../../integration/src/lib/matchAgentGameLauncher";
import { copyIkemenInstall, setIkemenWindowSize } from "../../../integration/src/lib/ikemenInstall";
import { REPO_ROOT } from "../../../integration/src/constants";

export const IKEMEN_PLUGIN_NAME = "@roster-lock/game-launcher-ikemen-go";
const IKEMEN_PLUGIN_PATH = "plugins/game-launcher/ikemen-go";

// Same set run.ts installs - dl-protocol/dl-archive plugins so
// downloadToFolder can actually fetch+extract a piece's .tar over http://,
// plus the untrusted script/config runtimes and the game launcher itself.
const REQUIRED_PLUGINS = [
  "plugins/untrusted/script/ts", "plugins/untrusted/config/json",
  "plugins/download/protocol/http", "plugins/download/archive/tar",
  IKEMEN_PLUGIN_PATH,
];

export type PlayerMatchAgent = {
  label: string,
  url: string,
  authCode: string,
  binaryLocation: string,
};


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
  processes: ProcessGroup, label: string, port: number, authCode: string, originalBinaryLocation: string,
  // Opt-in, for side-by-side recording (e.g. a demo video) - see setIkemenWindowSize's own docs
  // for why this has to happen before launch (patching save/config.ini) rather than as a
  // post-launch resize.
  windowSize?: { width: number, height: number },
): Promise<PlayerMatchAgent> {
  const piecesFolder = processes.mkTempDir(path.join(os.tmpdir(), `roster-lock-mugen-pw-${label}-pieces-`));
  const pluginFolder = processes.mkTempDir(path.join(os.tmpdir(), `roster-lock-mugen-pw-${label}-plugins-`));
  const url = `http://localhost:${port}`;

  // Explicit --config-file, not just --piece-folder/--plugin-folder: without it, `listen` falls
  // back to the shared ~/roster-lock/match-agent.json and unconditionally (non-atomically)
  // rewrites it on every startup - two players' processes launching close together race that
  // read/write against each other and one can come back truncated ("Unexpected end of JSON
  // input"), confirmed by hand. A config file scoped per player removes the shared state, not
  // just the timing window.
  const configFile = path.join(processes.mkTempDir(path.join(os.tmpdir(), `roster-lock-mugen-pw-${label}-config-`)), "match-agent.json");

  processes.spawnBackground(
    `match-agent-${label}`, process.execPath,
    [
      path.join(REPO_ROOT, "core/match-agent/dist/index.js"),
      "listen",
      "--port", String(port),
      "--auth-code", authCode,
      "--piece-folder", piecesFolder,
      "--plugin-folder", pluginFolder,
      "--config-file", configFile,
    ],
    { env: cleanSpawnEnv() }
  );
  await waitForHttpOk(url, 15_000);

  for (const pluginPath of REQUIRED_PLUGINS) {
    await installGameLauncherPlugin(url, authCode, path.join(REPO_ROOT, pluginPath));
  }

  const binaryLocation = await copyIkemenInstall(processes, label, originalBinaryLocation);
  if (windowSize) await setIkemenWindowSize(binaryLocation, windowSize.width, windowSize.height);
  await setGameLauncherSettings(url, authCode, IKEMEN_PLUGIN_NAME, { binaryLocation });

  return { label, url, authCode, binaryLocation };
}

export type PreparePlayerMatchAgentOptions = {
  windowSize?: { width: number, height: number },
  // Skips both the ikemen-go plugin install and its binaryLocation settings write here - for a
  // demo recording where that install is instead driven live through titled-room/client's Create
  // Room page ("missing" game launcher -> Install button), which opens
  // InstallGameLauncherLightbox on this same match-agent-client page and does both of those
  // itself (see scripts/record-demo.ts's installIkemenPluginViaUI). The other REQUIRED_PLUGINS
  // (script/config runtimes, download protocol/archive) have no such UI anywhere in the real app,
  // so those still get installed programmatically either way.
  installIkemenViaUI?: boolean,
};

/**
 * Same post-launch setup as startPlayerMatchAgent (plugin installs, Ikemen install copy +
 * config.ini window sizing, binaryLocation settings) but for a match-agent process that's already
 * running - started externally (e.g. in its own terminal window, for a recording) rather than
 * spawned by this process - so this waits for it to come up instead of spawning it itself.
 */
export async function preparePlayerMatchAgent(
  processes: ProcessGroup, label: string, url: string, authCode: string, originalBinaryLocation: string,
  options: PreparePlayerMatchAgentOptions = {},
): Promise<PlayerMatchAgent> {
  const { windowSize, installIkemenViaUI = false } = options;

  await waitForHttpOk(url, 30_000);

  for (const pluginPath of REQUIRED_PLUGINS) {
    if (installIkemenViaUI && pluginPath === IKEMEN_PLUGIN_PATH) continue;
    await installGameLauncherPlugin(url, authCode, path.join(REPO_ROOT, pluginPath));
  }

  const binaryLocation = await copyIkemenInstall(processes, label, originalBinaryLocation);
  if (windowSize) await setIkemenWindowSize(binaryLocation, windowSize.width, windowSize.height);
  if (!installIkemenViaUI) {
    await setGameLauncherSettings(url, authCode, IKEMEN_PLUGIN_NAME, { binaryLocation });
  }

  return { label, url, authCode, binaryLocation };
}
