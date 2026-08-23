import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { RosterLockV1Config, UserSelection } from "@roster-lock/types";

// What /download needs to run the sync-dl protocol, handed off by
// bridge/hostBridge.ts's initiateRelay handler once whatever matchmaker is
// loaded in /match-making's <iframe> hands off a relay room. Kept as its own
// context (not folded into the bridge hook's state) so /download stays
// reusable regardless of which matchmaker produced the session.
export type DownloadSession = {
  relay: { url: string, roomId: string },
  rosterConfig: RosterLockV1Config,
  gameLauncherPlugin: string,
  gameConfig: unknown,
  playerSelections: Record<number, UserSelection>,
  // Which side of a direct-tcp connection this machine is.
  isHost: boolean,
  // A direct-tcp game launcher's rendezvous coordinator address, resolved by
  // the matchmaker the same way it resolves `relay` (see
  // core/types's InitiateRelayEvent and
  // docs/v2/ikemen-go/game-coordinator.md) - null for game launchers that
  // don't use one.
  coordinator: { host: string, port: number } | null,
};

type DownloadSessionContextValue = {
  session: DownloadSession | null,
  setSession: (session: DownloadSession) => void,
  clearSession: () => void,
};

const DownloadSessionContext = createContext<DownloadSessionContextValue | null>(null);

export function DownloadSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<DownloadSession | null>(null);
  const setSession = useCallback((s: DownloadSession) => setSessionState(s), []);
  const clearSession = useCallback(() => setSessionState(null), []);
  return (
    <DownloadSessionContext.Provider value={{ session, setSession, clearSession }}>
      {children}
    </DownloadSessionContext.Provider>
  );
}

export function useDownloadSession(): DownloadSessionContextValue {
  const ctx = useContext(DownloadSessionContext);
  if (!ctx) throw new Error("useDownloadSession must be used within a DownloadSessionProvider");
  return ctx;
}
