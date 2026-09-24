import { HTTPRouter } from "../../../utils/http-router";
import { V1Env } from "../globals/types";
import { listAvailableGameLaunchers, installGameLauncherPlugin } from "./listing";
import { getGameLauncherSettings, setGameLauncherSettings, pickGameLauncherBinaryLocation } from "./settings";
import {
  getGameLauncherVersion, validateGameLauncherBinaryLocation, validateGameLauncherGameConfig, updateGameLauncherBinary,
} from "./version";
import { getGameLauncherPreview } from "./preview";
import { startGameLauncher } from "./start";
import { getGameProcessStatus, listGameProcesses, stopGameProcess } from "./process";

// Mounted at /game-launcher (see index.ts's httpRouter.use) - every path
// below is relative to that prefix. gameProcessesWs, the one WS route in
// this family, isn't part of this router: WebSocketRouter has no
// prefix/child-router support, so it's mounted directly on wsRouter in
// index.ts instead.
export function createGameLauncherRouter(env: V1Env): HTTPRouter {
  const router = new HTTPRouter();
  router.get("/available", listAvailableGameLaunchers.bind(env));
  // Plugin-agnostic - lists every process this
  // match-agent has started across every plugin (see pages/Game in
  // match-agent-client), not just one plugin's.
  router.get("/processes", listGameProcesses.bind(env));

  router.post("/:pluginName/install", installGameLauncherPlugin.bind(env));
  router.get("/:pluginName/settings", getGameLauncherSettings.bind(env));
  router.put("/:pluginName/settings", setGameLauncherSettings.bind(env));
  router.post("/:pluginName/pick-binary-location", pickGameLauncherBinaryLocation.bind(env));
  router.get("/:pluginName/version", getGameLauncherVersion.bind(env));
  router.get("/:pluginName/validate", validateGameLauncherBinaryLocation.bind(env));
  router.post("/:pluginName/validate-game-config", validateGameLauncherGameConfig.bind(env));
  router.post("/:pluginName/update", updateGameLauncherBinary.bind(env));
  router.post("/:pluginName/start", startGameLauncher.bind(env));
  router.post("/:pluginName/preview", getGameLauncherPreview.bind(env));
  router.get("/:pluginName/process/:handleId", getGameProcessStatus.bind(env));
  router.post("/:pluginName/process/:handleId/stop", stopGameProcess.bind(env));

  return router;
}
