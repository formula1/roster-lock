import { createShaFromJSON } from "@roster-lock/utils";
import { RosterLockV1Config } from "@roster-lock/types";
import { validateGameConfig } from "@roster-lock/game-launcher-ikemen-go/selection-validation";
import ikemenPackageJson from "@roster-lock/game-launcher-ikemen-go/package.json";
import { Env } from "./types";

// Read off the published package.json rather than imported from
// src/engineConfig.ts (which computes it via node:crypto synchronously - see
// that file's own comment): this project's tsconfig deliberately restricts
// `types` to @cloudflare/workers-types only, to catch exactly this kind of
// accidental Node-only dependency creeping into a Worker's type-checked
// surface - selection-validation.ts is written Node-free for the same
// reason, engineConfig.ts isn't. A plain JSON import has no such concern,
// and package.json's "roster-lock".engineSha is guarded against drifting
// from engineConfig.ts by that plugin's own test/engineConfig.test.ts.
const IKEMEN_ENGINE_SHA: string = ikemenPackageJson["roster-lock"].engineSha;

// This is mugen's own matchmaker (see docs/v2/ikemen-go/titled-room.md) - it
// only ever offers one game launcher, so this is the allowlist. There's no
// admin API/DB-backed registration anymore (that existed for a game-agnostic
// version of this service that no longer exists - see git history if a
// second game launcher ever needs to be supported here).
export const IKEMEN_PLUGIN_NAME = "@roster-lock/game-launcher-ikemen-go";

// Used by titled-room/client's Create.tsx to diff against the host's
// installed plugins (getInstalledGameLauncherPlugins) and offer an install
// button for whatever's missing.
export async function listAllowedGameLaunchers(): Promise<Array<{ pluginName: string }>> {
  return [{ pluginName: IKEMEN_PLUGIN_NAME }];
}

// A room may only be created for ikemen-go, and only when the roster
// config's own engine.pieceDefinitions actually hashes to
// IKEMEN_ENGINE_SHA - the same "Engine Sha" comparison
// plugins/game-launcher/ikemen-go/src/engineConfig.ts documents (a mismatch
// means the roster's piece layout doesn't match what the plugin structurally
// needs, e.g. a missing defName path variable).
export async function assertGameLauncherAllowed(pluginName: string, rosterConfig: any): Promise<void> {
  if (pluginName !== IKEMEN_PLUGIN_NAME) {
    throw new Error(`Game launcher "${pluginName}" is not allowed on this matchmaker`);
  }

  const pieceDefinitions = rosterConfig?.engine?.pieceDefinitions;
  if (!pieceDefinitions) {
    throw new Error("rosterConfig.engine.pieceDefinitions is required");
  }

  const actualSha = await createShaFromJSON(pieceDefinitions);
  if (actualSha !== IKEMEN_ENGINE_SHA) {
    throw new Error(`rosterConfig.engine.pieceDefinitions doesn't match "${pluginName}"'s expected engineSha`);
  }
}

// Server-side half of the same check a room-creation client already ran (see titled-room/client's
// Create.tsx, which calls the identical plugin function locally via match-agent's bridge) - a
// client that skips or is tricked out of that call shouldn't be able to create an invalid room
// anyway.
export async function assertGameConfigValid(
  pluginName: string, gameConfig: unknown, rosterConfig: RosterLockV1Config
): Promise<void> {
  if (pluginName !== IKEMEN_PLUGIN_NAME) return;

  const problems = await validateGameConfig(gameConfig, rosterConfig);
  if (problems.length > 0) {
    throw new Error(problems.join("; "));
  }
}

// The address a client should connect to once the room starts (see
// docs/v2/ikemen-go/game-coordinator.md: the client learns this the same way
// it learns relayUrl, via the /room/start response/broadcast). Deployment-
// configured (env vars), not admin-managed - see wrangler.toml/Dockerfile.
export type GameCoordinatorConfig = { id: string, address: { host: string, port: number } };

export async function gameCoordinatorFor(env: Env, pluginName: string): Promise<GameCoordinatorConfig | false> {
  if (pluginName !== IKEMEN_PLUGIN_NAME) {
    throw new Error(`No game-launcher config for "${pluginName}"`);
  }
  if (!env.GAME_COORDINATOR_ID) return false;
  if (!env.IKEMEN_COORDINATOR_TCP_HOST || !env.IKEMEN_COORDINATOR_TCP_PORT) {
    throw new Error("GAME_COORDINATOR_ID is set but IKEMEN_COORDINATOR_TCP_HOST/IKEMEN_COORDINATOR_TCP_PORT are missing");
  }
  return {
    id: env.GAME_COORDINATOR_ID,
    address: { host: env.IKEMEN_COORDINATOR_TCP_HOST, port: Number(env.IKEMEN_COORDINATOR_TCP_PORT) },
  };
}
