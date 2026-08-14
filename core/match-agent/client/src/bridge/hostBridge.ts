import { RefObject, useEffect, useRef, useState } from "react";
import { MessageBridge, waitForBridgeEvent } from "@roster-lock/utils";
import {
  MATCHMAKER_BRIDGE_PATHS,
  InstallGameRunnerPluginRequest, InstallGameRunnerPluginResponse,
  GetInstalledGameRunnerPluginsResponse,
  GetIdentityResponse,
  RequestSelectionRequest, RequestSelectionResponse,
  UpdateGameRunnerSettingsRequest, UpdateGameRunnerSettingsResponse,
  InitiateRelayEvent,
} from "@roster-lock/types";
import { UserKeyPair } from "@roster-lock/ts-client";
import { listAvailableGameRunners } from "../api/matchAgent";
import { PlayerSlot } from "../context/JoinSettingsContext";
import { DownloadSession } from "../context/DownloadSessionContext";

export type PendingLightbox = (
  | { type: "install", pluginName: string, resolve: () => void }
  | { type: "selection", rosterConfig: RequestSelectionRequest["rosterLockConfig"], numPlayers: number, resolve: (v: RequestSelectionResponse) => void, reject: (e: Error) => void }
);

// Host-side half of the matchmaker bridge protocol (see
// core/types/src/v1/runtime/matchmaker-bridge) - one instance per mounted
// <iframe>, built once the guest signals "ready" (mirrors the "wait for the
// other side's bridge to come up" handshake @roster-lock/ts-client's
// sync-dl.ws.ts uses over WebSocket, just over postMessage here).
export function useHostBridge(args: {
  iframeRef: RefObject<HTMLIFrameElement | null>,
  iframeLoaded: boolean,
  matchAgent: { url: string, authCode: string },
  identityKeys: UserKeyPair,
  machineId: string,
  playerSlots: Array<PlayerSlot>,
  onInitiateRelay: (session: DownloadSession) => void,
}) {
  const { iframeRef, iframeLoaded, matchAgent, identityKeys, machineId, playerSlots, onInitiateRelay } = args;

  const [pendingLightbox, setPendingLightbox] = useState<PendingLightbox | null>(null);
  const [connected, setConnected] = useState(false);
  const bridgeRef = useRef<MessageBridge | null>(null);
  const pendingGameConfigRef = useRef<unknown>(undefined);
  const pendingSelectionRef = useRef<Record<number, unknown> | null>(null);

  // Stable across renders via refs, so the bridge's onRequest handlers
  // always see current props without needing to be torn down/rebuilt.
  const latest = useRef(args);
  latest.current = args;

  useEffect(() => {
    if (!iframeLoaded) return;
    setConnected(false);

    const bridge = new MessageBridge((message) => {
      iframeRef.current?.contentWindow?.postMessage(message, "*");
    });
    bridgeRef.current = bridge;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      bridge.handleMessage(event.data).catch(() => {});
    };
    window.addEventListener("message", onMessage);

    bridge.onRequest(MATCHMAKER_BRIDGE_PATHS.installGameRunnerPlugin, ({ pluginName }: InstallGameRunnerPluginRequest) => {
      return new Promise<InstallGameRunnerPluginResponse>((resolve) => {
        setPendingLightbox({ type: "install", pluginName, resolve: () => resolve({}) });
      });
    });

    bridge.onRequest(MATCHMAKER_BRIDGE_PATHS.getInstalledGameRunnerPlugins, async (): Promise<GetInstalledGameRunnerPluginsResponse> => {
      const runners = await listAvailableGameRunners(latest.current.matchAgent.url, latest.current.matchAgent.authCode);
      return runners.map((r) => ({ id: r.pluginName, version: r.version }));
    });

    bridge.onRequest(MATCHMAKER_BRIDGE_PATHS.getIdentity, (): GetIdentityResponse => ({
      publicKey: latest.current.identityKeys.publicKey,
      machineId: latest.current.machineId,
      playerCount: latest.current.playerSlots.length,
    }));

    bridge.onRequest(
      MATCHMAKER_BRIDGE_PATHS.requestSelection,
      ({ rosterLockConfig, numPlayers }: RequestSelectionRequest) => {
        return new Promise<RequestSelectionResponse>((resolve, reject) => {
          setPendingLightbox({
            type: "selection",
            rosterConfig: rosterLockConfig,
            numPlayers,
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
      MATCHMAKER_BRIDGE_PATHS.updateGameRunnerSettings,
      ({ gameConfig }: UpdateGameRunnerSettingsRequest): UpdateGameRunnerSettingsResponse => {
        pendingGameConfigRef.current = gameConfig;
        return {};
      }
    );

    bridge.onEvent(MATCHMAKER_BRIDGE_PATHS.initiateRelay, (payload: InitiateRelayEvent) => {
      if (!pendingSelectionRef.current) return;
      latest.current.onInitiateRelay({
        relay: payload.relay,
        rosterConfig: payload.rosterConfig,
        gameRunnerPlugin: payload.gameRunnerPlugin,
        gameConfig: pendingGameConfigRef.current,
        playerSelections: pendingSelectionRef.current as DownloadSession["playerSelections"],
        isHost: payload.isHost,
        coordinator: payload.coordinator,
      });
    });

    waitForBridgeEvent(bridge, MATCHMAKER_BRIDGE_PATHS.ready, 15_000)
      .then(() => setConnected(true))
      .catch(() => {});

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

  const resolveSelectionLightbox = (selection: RequestSelectionResponse) => {
    if (pendingLightbox?.type === "selection") pendingLightbox.resolve(selection);
    setPendingLightbox(null);
  };

  const cancelSelectionLightbox = () => {
    if (pendingLightbox?.type === "selection") pendingLightbox.reject(new Error("cancelled"));
    setPendingLightbox(null);
  };

  return { connected, pendingLightbox, resolveInstallLightbox, resolveSelectionLightbox, cancelSelectionLightbox };
}
