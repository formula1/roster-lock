import { RefObject, useEffect, useRef, useState } from "react";
import { MessageBridge, waitForBridgeEvent } from "@roster-lock/utils";
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
import { UserKeyPair } from "@roster-lock/ts-client";
import { listAvailableGameLaunchers, validateGameLauncherGameConfig } from "../api/matchAgent";
import { PlayerSlot } from "../context/JoinSettingsContext";
import { DownloadSession } from "../context/DownloadSessionContext";

export type PendingLightbox = (
  | { type: "install", pluginName: string, resolve: () => void, reject: (e: Error) => void }
  | {
      type: "selection", rosterConfig: RequestSelectionRequest["rosterLockConfig"], numPlayers: number,
      pluginName: string, resolve: (v: RequestSelectionResponse) => void, reject: (e: Error) => void,
    }
);

// Host-side half of the matchmaker bridge protocol (see
// core/types/src/v1/runtime/matchmaker-bridge) - one instance per mounted
// <iframe>, built once the guest signals "ready" (mirrors the "wait for the
// other side's bridge to come up" handshake @roster-lock/ts-client's
// sync-dl.ws.ts uses over WebSocket, just over postMessage here).
export function useHostBridge(args: {
  iframeRef: RefObject<HTMLIFrameElement | null>,
  iframeLoaded: number,
  matchAgent: { url: string, authCode: string },
  identityKeys: UserKeyPair,
  machineId: string,
  playerSlots: Array<PlayerSlot>,
  onInitiateRelay: (session: DownloadSession) => void,
}) {
  const { iframeRef, iframeLoaded, matchAgent, identityKeys, machineId, playerSlots, onInitiateRelay } = args;

  const activeConnection = useRef<number>(-1);

  const [pendingLightbox, setPendingLightbox] = useState<PendingLightbox | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const bridgeRef = useRef<MessageBridge | null>(null);
  const pendingGameConfigRef = useRef<unknown>(undefined);
  const pendingSelectionRef = useRef<Record<number, unknown> | null>(null);

  // Stable across renders via refs, so the bridge's onRequest handlers
  // always see current props without needing to be torn down/rebuilt.
  const latest = useRef(args);
  latest.current = args;

  useEffect(() => {
    if (iframeLoaded === -1) return;
    activeConnection.current = iframeLoaded
    setConnected(false);
    setConnectionError(false);

    const bridge = new MessageBridge((message) => {
      iframeRef.current?.contentWindow?.postMessage(message, "*");
    });
    bridgeRef.current = bridge;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      bridge.handleMessage(event.data).catch(() => {});
    };
    window.addEventListener("message", onMessage);

    bridge.onRequest(MATCHMAKER_BRIDGE_PATHS.installGameLauncherPlugin, ({ pluginName }: InstallGameLauncherPluginRequest) => {
      return new Promise<InstallGameLauncherPluginResponse>((resolve, reject) => {
        setPendingLightbox({ type: "install", pluginName, resolve: () => resolve({}), reject: (e) => reject(e) });
      });
    });

    bridge.onRequest(MATCHMAKER_BRIDGE_PATHS.getInstalledGameLauncherPlugins, async (): Promise<GetInstalledGameLauncherPluginsResponse> => {
      const runners = await listAvailableGameLaunchers(latest.current.matchAgent.url, latest.current.matchAgent.authCode);
      return runners.map((r) => ({ id: r.pluginName, version: r.version, gameConfigSchema: r.gameConfigSchema }));
    });

    bridge.onRequest(MATCHMAKER_BRIDGE_PATHS.getIdentity, (): GetIdentityResponse => ({
      publicKey: latest.current.identityKeys.publicKey,
      machineId: latest.current.machineId,
      playerCount: latest.current.playerSlots.length,
    }));

    bridge.onRequest(
      MATCHMAKER_BRIDGE_PATHS.requestSelection,
      ({ rosterLockConfig, numPlayers, pluginName }: RequestSelectionRequest) => {
        return new Promise<RequestSelectionResponse>((resolve, reject) => {
          setPendingLightbox({
            type: "selection",
            rosterConfig: rosterLockConfig,
            numPlayers,
            pluginName,
            resolve: (selection) => {
              pendingSelectionRef.current = selection;
              resolve(selection);
            },
            reject: (e) => reject(e),
          });
        });
      }
    );

    bridge.onRequest(
      MATCHMAKER_BRIDGE_PATHS.updateGameLauncherSettings,
      ({ gameConfig }: UpdateGameLauncherSettingsRequest): UpdateGameLauncherSettingsResponse => {
        pendingGameConfigRef.current = gameConfig;
        return {};
      }
    );

    bridge.onRequest(
      MATCHMAKER_BRIDGE_PATHS.validateGameConfig,
      async ({ pluginName, gameConfig, rosterConfig }: ValidateGameConfigRequest): Promise<ValidateGameConfigResponse> => {
        const problems = await validateGameLauncherGameConfig(
          latest.current.matchAgent.url, latest.current.matchAgent.authCode, pluginName, gameConfig, rosterConfig
        );
        return { problems };
      }
    );

    bridge.onEvent(MATCHMAKER_BRIDGE_PATHS.initiateRelay, (payload: InitiateRelayEvent) => {
      if (!pendingSelectionRef.current) return;
      latest.current.onInitiateRelay({
        relay: payload.relay,
        rosterConfig: payload.rosterConfig,
        gameLauncherPlugin: payload.gameLauncherPlugin,
        gameConfig: pendingGameConfigRef.current,
        playerSelections: pendingSelectionRef.current as DownloadSession["playerSelections"],
        isHost: payload.isHost,
        coordinator: payload.coordinator,
      });
    });

    waitForBridgeEvent(bridge, MATCHMAKER_BRIDGE_PATHS.ready, 15_000)
      .then(() => setConnected(true))
      .catch(()=>{
        if(activeConnection.current !== iframeLoaded) return;
        setConnectionError(true)
      });

    return () => {
      window.removeEventListener("message", onMessage);
      bridgeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iframeLoaded]);

  const resolveInstallLightbox = () => {
    if (pendingLightbox?.type === "install") pendingLightbox.resolve();
    setPendingLightbox(null);
  };

  const cancelInstallLightbox = () => {
    if (pendingLightbox?.type === "install") pendingLightbox.reject(new Error("cancelled"));
    setPendingLightbox(null);
  };

  const resolveSelectionLightbox = (selection: RequestSelectionResponse) => {
    if (pendingLightbox?.type === "selection") pendingLightbox.resolve(selection);
    setPendingLightbox(null);
  };

  const cancelSelectionLightbox = () => {
    if (pendingLightbox?.type === "selection") pendingLightbox.reject(new Error("cancelled"));
    setPendingLightbox(null);
  };

  return {
    connected, connectionError, pendingLightbox,
    resolveInstallLightbox, cancelInstallLightbox, resolveSelectionLightbox, cancelSelectionLightbox,
  };
}
