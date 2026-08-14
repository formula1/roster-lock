import { MessageBridge } from "@roster-lock/utils";
import {
  MATCHMAKER_BRIDGE_PATHS,
  InstallGameRunnerPluginRequest, InstallGameRunnerPluginResponse,
  GetInstalledGameRunnerPluginsResponse,
  GetIdentityResponse,
  RequestSelectionRequest, RequestSelectionResponse,
  UpdateGameRunnerSettingsRequest, UpdateGameRunnerSettingsResponse,
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

export async function installGameRunnerPlugin(pluginName: string): Promise<void> {
  await bridge.sendRequest(
    MATCHMAKER_BRIDGE_PATHS.installGameRunnerPlugin,
    { pluginName } satisfies InstallGameRunnerPluginRequest
  ) as InstallGameRunnerPluginResponse;
}

export async function getInstalledGameRunnerPlugins(): Promise<GetInstalledGameRunnerPluginsResponse> {
  return await bridge.sendRequest(MATCHMAKER_BRIDGE_PATHS.getInstalledGameRunnerPlugins, {});
}

export async function getIdentity(): Promise<GetIdentityResponse> {
  return await bridge.sendRequest(MATCHMAKER_BRIDGE_PATHS.getIdentity, {});
}

export async function requestSelection(
  rosterLockConfig: RequestSelectionRequest["rosterLockConfig"], numPlayers: number
): Promise<RequestSelectionResponse> {
  return await bridge.sendRequest(
    MATCHMAKER_BRIDGE_PATHS.requestSelection,
    { rosterLockConfig, numPlayers } satisfies RequestSelectionRequest
  );
}

export async function updateGameRunnerSettings(pluginName: string, gameConfig: unknown): Promise<void> {
  await bridge.sendRequest(
    MATCHMAKER_BRIDGE_PATHS.updateGameRunnerSettings,
    { pluginName, gameConfig } satisfies UpdateGameRunnerSettingsRequest
  ) as UpdateGameRunnerSettingsResponse;
}

export function initiateRelay(payload: InitiateRelayEvent): void {
  bridge.sendEvent(MATCHMAKER_BRIDGE_PATHS.initiateRelay, payload);
}
