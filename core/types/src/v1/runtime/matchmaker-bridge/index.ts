import { RosterLockV1Config } from "../../lock";
import { UserSelection } from "../../request";

// The wire protocol between a matchmaker UI (loaded in an <iframe>, e.g.
// examples/services/match-makers/titled-room/client) and its host shell (e.g.
// core/match-agent/client), carried over a postMessage-backed MessageBridge
// (@roster-lock/utils). All six calls are iframe -> host; the host never
// initiates. MessageBridge itself is untyped (see its own docs) - these
// types exist purely so both sides' thin bridge wrapper modules agree on
// shape, not because MessageBridge enforces it.
//
// Deliberately excludes any raw-signing/private-key primitive - titled-room
// (the first matchmaker built against this protocol) uses JWT/bearer auth,
// not signatures, so nothing needs one yet. A future signature-auth
// matchmaker would need a new request added here, not a workaround.

// installGameRunnerPlugin(pluginName) - host installs the plugin package and
// opens a lightbox that also lets the user finish local config
// (binaryLocation) before resolving.
export type InstallGameRunnerPluginRequest = { pluginName: string };
export type InstallGameRunnerPluginResponse = {};

// getInstalledGameRunnerPlugins() - what game-runner plugins this machine
// already has installed, so a matchmaker's room UI can tell a user "you
// don't have this one yet" without ever touching match-agent itself.
export type GetInstalledGameRunnerPluginsResponse = Array<{ id: string, version: string }>;

// getIdentity() - never includes the private key, only what's safe for a
// matchmaker to see. playerCount reflects the host's own local player-slot
// count (Join Settings), not anything the guest can set.
export type GetIdentityResponse = { publicKey: string, machineId: string, playerCount: number };

// requestSelection(rosterLockConfig, numPlayers) - host opens the Selection
// lightbox for exactly `numPlayers` local player slots and resolves with the
// built selection once confirmed. Unlike the other calls, the selection
// *content* does cross back to the guest here - it isn't secret, only the
// private key is.
export type RequestSelectionRequest = { rosterLockConfig: RosterLockV1Config, numPlayers: number };
export type RequestSelectionResponse = Record<number, UserSelection>;

// updateGameRunnerSettings(pluginName, gameConfig) - room-shared settings a
// game runner needs before it can start (e.g. ikemen-go's teamMode). The
// host holds onto this and folds it into the eventual
// /v1/game-runner/:pluginName/start call it makes later, since the host
// (not the guest) is the one that ends up calling that route.
export type UpdateGameRunnerSettingsRequest = { pluginName: string, gameConfig: unknown };
export type UpdateGameRunnerSettingsResponse = {};

// initiateRelay(...) - fire-and-forget event, not a request: the guest is
// about to be torn down (host navigates away from the iframe entirely), so
// there's nothing useful to await. Host merges this with whatever it already
// has from requestSelection/updateGameRunnerSettings and navigates to
// wherever it runs its own download/start-game flow.
export type InitiateRelayEvent = {
  relay: { url: string, roomId: string },
  rosterConfig: RosterLockV1Config,
  gameRunnerPlugin: string,
  isHost: boolean,
  // A direct-tcp game runner's rendezvous coordinator (see
  // plugins/shared/direct-ip-coordinator and
  // docs/v2/ikemen-go/game-coordinator.md) - null for game runners that
  // don't use one (a matchmaker resolves this the same way it resolves
  // `relay`, e.g. titled-room's /room/start response).
  coordinator: { host: string, port: number } | null,
};

// Bridge message/event path names, so both sides reference the same literal
// strings instead of hand-typing them.
export const MATCHMAKER_BRIDGE_PATHS = {
  installGameRunnerPlugin: "installGameRunnerPlugin",
  getInstalledGameRunnerPlugins: "getInstalledGameRunnerPlugins",
  getIdentity: "getIdentity",
  requestSelection: "requestSelection",
  updateGameRunnerSettings: "updateGameRunnerSettings",
  initiateRelay: "initiateRelay",
  ready: "ready",
} as const;
