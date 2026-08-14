import { createShaFromJSON } from "@roster-lock/utils";
import { Env } from "./types";

type GameRunnerConfigRow = {
  plugin_name: string,
  engine_sha: string,
  coordinator_id: string | null,
  coordinator_host: string | null,
  coordinator_port: number | null,
};

async function getGameRunnerConfig(env: Env, pluginName: string): Promise<GameRunnerConfigRow | null> {
  return env.DB.prepare(
    "SELECT * FROM game_runner_configs WHERE plugin_name = ?"
  ).bind(pluginName).first<GameRunnerConfigRow>();
}

// A room may only be created for a game-runner plugin an admin has
// explicitly allowed (see src/admin/game-runners.ts, which manages the
// game_runner_configs table this reads), and only when the roster config's
// own engine.pieceDefinitions actually hashes to that plugin's expected
// engineSha - the same "Engine Sha" comparison
// plugins/game-runner/ikemen-go/src/engineConfig.ts documents (a mismatch
// means the roster's piece layout doesn't match what the plugin structurally
// needs, e.g. a missing defName path variable). No config row means nothing
// is allowed, not everything, so a deployment has to opt a plugin in rather
// than remember to opt everything else out.
export async function assertGameRunnerAllowed(
  env: Env, pluginName: string, rosterConfig: any
): Promise<void> {
  const config = await getGameRunnerConfig(env, pluginName);
  if (!config) {
    throw new Error(`Game runner "${pluginName}" is not allowed on this matchmaker`);
  }

  const pieceDefinitions = rosterConfig?.engine?.pieceDefinitions;
  if (!pieceDefinitions) {
    throw new Error("rosterConfig.engine.pieceDefinitions is required");
  }

  const actualSha = await createShaFromJSON(pieceDefinitions);
  if (actualSha !== config.engine_sha) {
    throw new Error(`rosterConfig.engine.pieceDefinitions doesn't match "${pluginName}"'s expected engineSha`);
  }
}

// A plugin's coordinator entry carries both the id relay-server's
// game_coordinators table knows it by (used to provision the relay room -
// see relay-client.ts) and the address a client should actually connect to
// once the room starts (see docs/v2/ikemen-go/game-coordinator.md: the
// client learns this the same way it learns relayUrl, via the /room/start
// response/broadcast - not a separately configured env var per client).
export type GameCoordinatorConfig = { id: string, address: { host: string, port: number } };

// Per-plugin relay Game Coordinator, from the same game_runner_configs row
// assertGameRunnerAllowed reads. Every allowlisted plugin must have an
// explicit coordinator choice recorded when an admin adds it (see
// src/admin/game-runners.ts) - `false` is a deliberate "this plugin needs no
// coordinator" choice (e.g. a fully-internal connection mode); a plugin with
// no config row at all is a deployment misconfiguration and throws, so it's
// never silently treated as an opt-out.
export async function gameCoordinatorFor(env: Env, pluginName: string): Promise<GameCoordinatorConfig | false> {
  const config = await getGameRunnerConfig(env, pluginName);
  if (!config) {
    throw new Error(`No game-runner config for "${pluginName}" - add one via POST /admin/game-runners`);
  }
  if (config.coordinator_id === null) return false;
  return {
    id: config.coordinator_id,
    address: { host: config.coordinator_host!, port: config.coordinator_port! },
  };
}
