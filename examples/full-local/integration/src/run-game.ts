/**
 * Fast-iteration script for debugging a match: assumes docker compose
 * services are already up and server-setup has already registered the
 * matchmaker/game-coordinator with the relay (see run.ts for the full
 * from-scratch orchestration). This just builds+starts match-agent and N
 * game-headless players against whatever is already running, so you don't
 * pay the docker/build/server-setup cost on every debugging iteration.
 *
 * Usage: tsx src/run-game.ts [numPlayers]
 */
import * as os from "os";
import * as path from "path";
import { ChildProcess } from "child_process";
import { ProcessGroup, runToCompletion, waitForExit, waitForHttpOk } from "./lib/process-utils";
import { loadEnvVars } from "./lib/env";

type GameResult = {
  winners: Array<string>,
  turnCount: number,
  randomSeed: Record<string, string>,
};

const FULL_LOCAL_DIR = path.resolve(__dirname, "../..");
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const ENV_VARS_DIR = path.join(FULL_LOCAL_DIR, "services/env-vars");
const ROSTER_LOCK_CONFIG_PATH = path.join(FULL_LOCAL_DIR, "simple-game.roster-lock.json");

const MATCH_AGENT_CONFIG = {
  port: String(58732),
  authCode: "abc123"
};

/** Builds+starts match-agent and numPlayers game-headless instances against already-running services. */
export async function runGame(numPlayers: number){
  const processes = new ProcessGroup();
  processes.registerCleanupOnSignals();

  try {
    const envVars = loadEnvVars(ENV_VARS_DIR);

    const piecesFolder = processes.mkTempDir(path.join(os.tmpdir(), "roster-lock-pieces-"));
    await startMatchAgent(processes, { ...MATCH_AGENT_CONFIG, folder: piecesFolder });

    await runPlayers(processes, numPlayers, MATCH_AGENT_CONFIG, {
      matchmaker: envVars.PUBLIC_MATCHMAKER_URL,
      relayRoom: envVars.PUBLIC_RELAY_SERVER_URL,
      gameCoordinator: envVars.PUBLIC_GAME_COORDINATOR_URL
    })

    await processes.cleanup();
  } catch(err){
    console.error("Run failed:", err);
    await processes.cleanup();
    throw err;
  }
}

export async function startMatchAgent(
  processes: ProcessGroup, { port, authCode, folder }: { port: string, authCode: string, folder: string }
){
  console.log("Building match-agent...");
  const matchAgentUrl = `http://localhost:${port}`;
  const matchAgentBuildExit = await runToCompletion(
    "build", "pnpm", ["--filter", "@roster-lock/match-agent", "run", "build"], { cwd: REPO_ROOT }
  );
  if(matchAgentBuildExit !== 0) throw new Error("Failed to build match-agent");

  console.log(`Starting match-agent on port ${matchAgentUrl}...`);
  processes.spawnBackground(
    "match-agent", "node",
    [
      path.join(REPO_ROOT, "core/match-agent/dist/index.js"),
      "--port", port,
      "--auth-code", authCode,
      "--folder", folder,
    ]
  );
  await waitForHttpOk(matchAgentUrl, 15_000);
  console.log("match-agent is up.");
}

export async function runPlayers(
  processes: ProcessGroup,
  numPlayers: number,
  matchAgentConfig: { port: string, authCode: string },
  urls: { matchmaker: string, relayRoom: string, gameCoordinator: string }
){
  console.log("Building game-headless...");
  const gameHeadlessBuildExit = await runToCompletion(
    "build", "pnpm", ["--filter", "@roster-lock/headless-game-example", "run", "build"], { cwd: REPO_ROOT }
  );
  if(gameHeadlessBuildExit !== 0) throw new Error("Failed to build game-headless");

  console.log(`Starting ${numPlayers} game-headless instances...`);
  const gameHeadlessEntry = path.join(FULL_LOCAL_DIR, "game/game-headless/dist/index.js");
  const gameServerWsUrl = urls.gameCoordinator.replace(/^http/, "ws") + "/signaling";

  const playerProcesses = [];
  const resultPromises: Array<Promise<GameResult>> = [];
  for(let i = 1; i <= numPlayers; i++){
    const child = processes.spawnBackground(`player-${i}`, "node", [gameHeadlessEntry], {
      env: {
        ...process.env,
        PUBLIC_RELAY_SERVER_URL: urls.relayRoom,
        PUBLIC_MATCHMAKER_URL: urls.matchmaker,
        GAME_SERVER: gameServerWsUrl,
        MATCH_AGENT_AUTH: matchAgentConfig.authCode,
        MATCH_AGENT_URL: `http://localhost:${matchAgentConfig.port}`,
        MATCH_LOCK_CONFIG_PATH: ROSTER_LOCK_CONFIG_PATH,
        DISPLAY_NAME: `Player-${i}`,
      },
    });
    playerProcesses.push(child);
    resultPromises.push(captureGameResult(child));
  }

  const exitCodes = await Promise.all(playerProcesses.map(waitForExit));
  if(exitCodes.some(code => code !== 0)){
    throw new Error(`One or more game-headless instances failed (exit codes: ${exitCodes.join(", ")})`);
  }
  console.log("All game-headless instances finished successfully.");

  const results = await Promise.all(resultPromises);
  assertResultsAgree(results);
}

/**
 * Scrapes the `GAME_RESULT <json>` marker line (see game-headless/src/index.ts) out of a
 * player's stdout. Runs alongside spawnBackground's own listener on the same stream -
 * multiple "data" listeners on a Node stream is fine, this doesn't steal the log output.
 */
function captureGameResult(child: ChildProcess): Promise<GameResult> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    let resolved = false;
    child.stdout?.on("data", (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for(const line of lines){
        const match = line.match(/^GAME_RESULT (.+)$/);
        if(match){
          resolved = true;
          resolve(JSON.parse(match[1]));
        }
      }
    });
    child.on("exit", (code) => {
      if(!resolved) reject(new Error(`Process exited (code ${code}) without printing a GAME_RESULT line`));
    });
  });
}

/**
 * Each player runs its own independent local simulation, synced only over WebRTC moves and
 * a commit-reveal random seed - so agreement here is the real end-to-end proof that the
 * simulations actually stayed in lockstep, not just that every process exited 0.
 */
function assertResultsAgree(results: Array<GameResult>){
  const canonical = (result: GameResult) => JSON.stringify({
    winners: [...result.winners].sort(),
    turnCount: result.turnCount,
    randomSeed: Object.fromEntries(Object.entries(result.randomSeed).sort()),
  });

  const [first, ...rest] = results;
  if(!first) throw new Error("No player results to compare");

  for(const [i, result] of rest.entries()){
    if(canonical(result) !== canonical(first)){
      throw new Error(
        `Player ${i + 2} disagrees with player 1 on game outcome:\n` +
        `  player 1: ${canonical(first)}\n` +
        `  player ${i + 2}: ${canonical(result)}`
      );
    }
  }
  console.log(
    `Sanity check passed: all ${results.length} players agree on winners ` +
    `(${first.winners.join(", ")}), turnCount (${first.turnCount}), and random seed.`
  );
}