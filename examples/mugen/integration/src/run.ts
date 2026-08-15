import * as os from "os";
import * as path from "path";
import { ProcessGroup, runToCompletion, waitForHttpOk } from "./lib/process-utils";
import { loadEnvVars } from "./lib/env";
import { dockerComposeUp, dockerComposeDown, setupServers } from "./setupServers";
import { installGameRunnerPlugin, setGameRunnerSettings } from "./lib/matchAgentGameRunner";
import { copyIkemenInstall } from "./lib/ikemenInstall";
import * as player from "./players/player";
import { REPO_ROOT, ENV_VARS_DIR, ROSTER_LOCK_PATH } from "./constants";
import { RosterLockV1Config } from "@roster-lock/types";
import { readFileSync } from "fs";

const MATCH_AGENT_CONFIG = {
  port: String(58733), // full-local's own example uses 58732 - kept distinct so both can run at once
  authCode: "mugen-abc123",
};

const IKEMEN_PLUGIN_NAME = "@roster-lock/game-runner-ikemen-go";
const IKEMEN_PORT = 7500;

/** Full pipeline: docker compose up, match-agent, server setup, two real Ikemen GO processes, teardown. */
export async function runIntegration(binaryLocation: string){
  const processes = new ProcessGroup();
  processes.registerCleanupOnSignals(dockerComposeDown);

  try {
    await dockerComposeUp();

    const piecesFolder = processes.mkTempDir(path.join(os.tmpdir(), "roster-lock-mugen-pieces-"));
    const pluginFolder = processes.mkTempDir(path.join(os.tmpdir(), "roster-lock-mugen-plugins-"));
    const matchAgentUrl = await startMatchAgent(processes, piecesFolder, pluginFolder);

    console.log("Installing required plugin runtime dependencies into match-agent...");
    // Sequential, not Promise.all: installGameRunnerPlugin's arborist-based
    // install writes to match-agent's shared plugin manifest/node_modules -
    // concurrent installs race on that write and corrupt each other's
    // package.json (arborist/npm installs were never designed to run
    // concurrently against the same project directory).
    const requiredPlugins = [
      "plugins/untrusted/script/ts", "plugins/untrusted/config/json",
      // dl-protocol/dl-archive plugins downloadToFolder needs to actually
      // fetch+extract each piece's .tar over http:// (see
      // core/plugin-runtime/src/download/index.ts's getURLProtocol, which
      // throws "No protocol to handle url" without one installed).
      "plugins/download/protocol/http", "plugins/download/archive/tar",
      "plugins/game-runner/ikemen-go",
    ];
    for(const pluginPath of requiredPlugins){
      await installGameRunnerPlugin(matchAgentUrl, MATCH_AGENT_CONFIG.authCode, path.join(REPO_ROOT, pluginPath));
    }

    // See copyIkemenInstall's own docs for why every simulated player needs
    // its own copy of the install, not just its own binaryLocation setting -
    // binaryLocation is itself a match-agent-wide setting, and this
    // integration test shares one match-agent between both simulated
    // players (see MATCH_AGENT_CONFIG).
    console.log("Copying the Ikemen install once per simulated player (isolates save/config state)...");
    const [, hostBinaryLocation, clientBinaryLocation] = await Promise.all([
      setupServers(),
      copyIkemenInstall(processes, "host", binaryLocation),
      copyIkemenInstall(processes, "client", binaryLocation),
    ]);

    await runPlayers(matchAgentUrl, hostBinaryLocation, clientBinaryLocation);

    console.log("\nBoth Ikemen GO windows should now be running - this script leaves them up for you to play.");
    console.log("Press Ctrl+C to stop match-agent and tear down docker compose (the game windows will keep running).");
    await new Promise(() => {}); // keep the process (and match-agent) alive until Ctrl+C
  } catch(err){
    console.error("Integration run failed:", err);
    await processes.cleanup(dockerComposeDown);
    throw err;
  }
}

async function startMatchAgent(processes: ProcessGroup, piecesFolder: string, pluginFolder: string): Promise<string> {
  console.log("Building match-agent...");
  const buildExit = await runToCompletion(
    "build", "pnpm", ["--filter", "@roster-lock/match-agent", "run", "build"], { cwd: REPO_ROOT }
  );
  if(buildExit !== 0) throw new Error("Failed to build match-agent");

  const matchAgentUrl = `http://localhost:${MATCH_AGENT_CONFIG.port}`;
  console.log(`Starting match-agent on ${matchAgentUrl}...`);
  processes.spawnBackground(
    "match-agent", process.execPath,
    [
      path.join(REPO_ROOT, "core/match-agent/dist/index.js"),
      "listen",
      "--port", MATCH_AGENT_CONFIG.port,
      "--auth-code", MATCH_AGENT_CONFIG.authCode,
      "--piece-folder", piecesFolder,
      "--plugin-folder", pluginFolder,
    ]
  );
  await waitForHttpOk(matchAgentUrl, 15_000);
  console.log("match-agent is up.");
  return matchAgentUrl;
}

async function runPlayers(matchAgentUrl: string, hostBinaryLocation: string, clientBinaryLocation: string){
  const env = loadEnvVars(ENV_VARS_DIR);
  const authServiceUrl = requireEnv(env, "PUBLIC_AUTH_SERVICE_URL");
  const titledRoomUrl = requireEnv(env, "PUBLIC_TITLED_ROOM_URL");
  const publicRelayServerUrl = requireEnv(env, "PUBLIC_RELAY_SERVER_URL");
  const coordinator = {
    host: requireEnv(env, "IKEMEN_COORDINATOR_TCP_HOST"),
    port: Number(requireEnv(env, "IKEMEN_COORDINATOR_TCP_PORT")),
  };

  const rosterConfig = JSON.parse(readFileSync(ROSTER_LOCK_PATH, "utf-8")) as RosterLockV1Config;
  // No explicit teamMode override - left for buildIkemenArgs to resolve from
  // the roster's own engine.officialSelections (this lock's selection hash
  // matches the "tag" entry) - see ikemen-go's readme, "Team mode comes from
  // the selection config".
  const gameConfig = {};

  console.log("Registering and logging in both simulated players...");
  const runId = Date.now();
  const [host, client] = await Promise.all([
    player.setupIdentity(authServiceUrl, `host-${runId}`, "Password1"),
    player.setupIdentity(authServiceUrl, `client-${runId}`, "Password1"),
  ]);

  console.log("Host creating room, client joining...");
  const roomId = await player.hostCreateRoom(titledRoomUrl, host, rosterConfig, gameConfig);
  await player.clientJoinRoom(titledRoomUrl, client, roomId);

  console.log("Both players making a selection and marking ready...");
  const [hostSelection, clientSelection] = await Promise.all([
    player.selectAndReady(titledRoomUrl, host, roomId, rosterConfig),
    player.selectAndReady(titledRoomUrl, client, roomId, rosterConfig),
  ]);

  console.log("Starting the match once both are ready...");
  const started = await player.startRoomWhenReady(titledRoomUrl, host, roomId, 2);
  console.log(`Relay room ready: ${started.relayUrl} / ${started.roomId}`);

  console.log("Both players syncing selections and downloading pieces via the relay...");
  const relay = { url: publicRelayServerUrl, roomId: started.roomId };
  const [hostSync, clientSync] = await Promise.all([
    player.relayAndDownload(host, relay, rosterConfig, hostSelection, MATCH_AGENT_CONFIG.authCode, matchAgentUrl),
    player.relayAndDownload(client, relay, rosterConfig, clientSelection, MATCH_AGENT_CONFIG.authCode, matchAgentUrl),
  ]);

  if(!started.coordinator){
    throw new Error("titled-room didn't return a coordinator address - check /admin/game-runners registration");
  }

  console.log("Launching Ikemen GO for both players...");
  // Sequential, not Promise.all: binaryLocation is a match-agent-wide
  // setting (both simulated players share one match-agent), so each
  // player's own copy of the install needs to be in place before *that
  // player's* startGameRunner call reads it - racing the two
  // setGameRunnerSettings writes against each other would make one player
  // launch from the wrong (or the other player's) copy.
  await setGameRunnerSettings(matchAgentUrl, MATCH_AGENT_CONFIG.authCode, IKEMEN_PLUGIN_NAME, { binaryLocation: hostBinaryLocation });
  await player.launchIkemen(
    matchAgentUrl, MATCH_AGENT_CONFIG.authCode, host, "host", IKEMEN_PORT, started.coordinator,
    hostSync.users, hostSync.downloadResult, rosterConfig, gameConfig, started.roomId,
  );
  await setGameRunnerSettings(matchAgentUrl, MATCH_AGENT_CONFIG.authCode, IKEMEN_PLUGIN_NAME, { binaryLocation: clientBinaryLocation });
  await player.launchIkemen(
    matchAgentUrl, MATCH_AGENT_CONFIG.authCode, client, "client", IKEMEN_PORT, started.coordinator,
    clientSync.users, clientSync.downloadResult, rosterConfig, gameConfig, started.roomId,
  );
}

function requireEnv(env: Record<string, string>, name: string): string {
  const value = env[name];
  if(!value) throw new Error(`${name} is not defined in examples/mugen/services/env-vars/*.env`);
  return value;
}
