import { MessageBridge } from "@roster-lock/utils";
import {
  MATCHMAKER_BRIDGE_PATHS,
  InstallGameLauncherPluginRequest, InstallGameLauncherPluginResponse,
  GetInstalledGameLauncherPluginsResponse,
  GetIdentityResponse,
  RequestSelectionRequest, RequestSelectionResponse,
  UpdateGameLauncherSettingsRequest, UpdateGameLauncherSettingsResponse,
  ValidateGameConfigRequest, ValidateGameConfigResponse,
  InitiateRelayEvent,
} from "@roster-lock/types";

// This app is meant to run inside a host shell's <iframe> - it never talks
// to match-agent directly, only to its own matchmaker backend (titled-room)
// and to the host over this bridge. See
// core/types/src/v1/runtime/matchmaker-bridge for the full protocol
// rationale (why each call is shaped the way it is, and why raw key
// material never crosses it).
const bridge = new MessageBridge((message) => window.parent.postMessage(message, "*"));

window.addEventListener("message", (event) => {
  if (event.source !== window.parent) return;
  bridge.handleMessage(event.data).catch(() => {});
});

// Lets the host's waitForBridgeEvent(bridge, "ready", ...) handshake resolve
// once this app has actually mounted and is listening.
export function announceReady(): void {
  bridge.sendEvent(MATCHMAKER_BRIDGE_PATHS.ready, {});
}

export async function installGameLauncherPlugin(pluginName: string): Promise<void> {
  await bridge.sendRequest(
    MATCHMAKER_BRIDGE_PATHS.installGameLauncherPlugin,
    { pluginName } satisfies InstallGameLauncherPluginRequest
  ) as InstallGameLauncherPluginResponse;
}

export async function getInstalledGameLauncherPlugins(): Promise<GetInstalledGameLauncherPluginsResponse> {
  return await bridge.sendRequest(MATCHMAKER_BRIDGE_PATHS.getInstalledGameLauncherPlugins, {});
}

export async function getIdentity(): Promise<GetIdentityResponse> {
  return await bridge.sendRequest(MATCHMAKER_BRIDGE_PATHS.getIdentity, {});
}

export async function requestSelection(
  rosterLockConfig: RequestSelectionRequest["rosterLockConfig"], numPlayers: number, pluginName: string
): Promise<RequestSelectionResponse> {
  return await bridge.sendRequest(
    MATCHMAKER_BRIDGE_PATHS.requestSelection,
    { rosterLockConfig, numPlayers, pluginName } satisfies RequestSelectionRequest
  );
}

export async function updateGameLauncherSettings(pluginName: string, gameConfig: unknown): Promise<void> {
  await bridge.sendRequest(
    MATCHMAKER_BRIDGE_PATHS.updateGameLauncherSettings,
    { pluginName, gameConfig } satisfies UpdateGameLauncherSettingsRequest
  ) as UpdateGameLauncherSettingsResponse;
}

// Asks the host to run the installed plugin's own validateGameConfig (if it has one) against a
// proposed gameConfig/rosterConfig pairing - so a room can be rejected before it's ever created,
// using the real plugin logic running locally rather than a copy of its rules re-implemented here.
export async function validateGameConfig(
  pluginName: string, gameConfig: unknown, rosterConfig: ValidateGameConfigRequest["rosterConfig"]
): Promise<Array<string>> {
  const response: ValidateGameConfigResponse = await bridge.sendRequest(
    MATCHMAKER_BRIDGE_PATHS.validateGameConfig,
    { pluginName, gameConfig, rosterConfig } satisfies ValidateGameConfigRequest
  );
  return response.problems;
}

export function initiateRelay(payload: InitiateRelayEvent): void {
  bridge.sendEvent(MATCHMAKER_BRIDGE_PATHS.initiateRelay, payload);
}
