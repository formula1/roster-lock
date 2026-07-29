import { createContext, useContext, useRef, useState, ReactNode } from "react";
import {
  RosterLockV1Config,
  RosterLockV1SyncDLResult,
  UserSelection,
} from "@roster-lock/types";
import { generateKeyPair, UserKeyPair } from "@roster-lock/ts-client";

export type MatchAgentConnection = {
  url: string;
  authCode: string;
  // The matchmaking and game-coordinator services are separate from the match
  // agent (game-headless reads them from distinct PUBLIC_MATCHMAKER_URL /
  // GAME_SERVER env vars) - kept alongside the match agent fields here since
  // there's nowhere else for a browser session to get them from.
  matchmakerUrl: string;
  // Base http(s) URL of the game coordinator; webrtc-room.ts derives the
  // ws(s)://.../signaling URL from it, matching how game-headless turns
  // GAME_SERVER's http(s) base into a ws(s) URL.
  gameCoordinatorUrl: string;
};

// Matches the full-local example's docker-compose ports (see
// examples/full-local/services/env-vars/internal-urls.env) and the match
// agent's own default --port. Good defaults for the common case of running
// this PWA against a locally-running full-local stack - the Settings screen
// lets them be overridden for anything else.
export const DEFAULT_MATCH_AGENT_CONNECTION: MatchAgentConnection = {
  url: "http://localhost:58732",
  authCode: "",
  matchmakerUrl: "http://localhost:7344",
  gameCoordinatorUrl: "http://localhost:7345",
};

export type CurrentUser = {
  machineId: string;
  displayName: string;
  keys: UserKeyPair;
};

export type MatchInfo = { roomId: string; url: string };

export type RoomUser = { machineId: string; publicKey: string; displayName: string; playerCount: number };

export type GameSummary = { winners: Array<string>; turnCount: number };

const STORAGE_KEY = "match-lock:game-pwa:session";

type PersistedState = {
  matchAgent: MatchAgentConnection | null;
  user: CurrentUser | null;
};

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { matchAgent: null, user: null };
    return JSON.parse(raw) as PersistedState;
  } catch {
    return { matchAgent: null, user: null };
  }
}

function savePersisted(state: PersistedState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

type GameSessionContextType = {
  matchAgent: MatchAgentConnection;
  // True only once the current matchAgent settings have been validated
  // against the match agent's /validate-authcode this session - deliberately
  // not persisted, so a stale/rotated auth code always gets re-checked on
  // load instead of trusting whatever was saved last time.
  connected: boolean;
  user: CurrentUser | null;
  rosterConfig: RosterLockV1Config | null;
  selection: UserSelection | null;
  match: MatchInfo | null;
  downloadResult: RosterLockV1SyncDLResult | null;
  users: Array<RoomUser> | null;
  gameSummary: GameSummary | null;

  // Persists connection settings (URLs + auth code) without asserting
  // they've been validated - use `connect` once validateAuthCode succeeds.
  updateSettings: (settings: MatchAgentConnection) => void;
  connect: (displayName: string) => Promise<void>;
  setRosterConfig: (config: RosterLockV1Config) => void;
  setSelection: (selection: UserSelection) => void;
  setMatch: (match: MatchInfo) => void;
  setDownloadResult: (result: RosterLockV1SyncDLResult, users: Array<RoomUser>) => void;
  finishGame: (summary: GameSummary) => void;
};

const GameSessionContext = createContext<GameSessionContextType | undefined>(undefined);

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const persisted = loadPersisted();

  const [matchAgent, setMatchAgentState] = useState<MatchAgentConnection>(
    persisted.matchAgent ?? DEFAULT_MATCH_AGENT_CONNECTION,
  );
  const [connected, setConnected] = useState(false);
  const [user, setUserState] = useState<CurrentUser | null>(persisted.user);
  // updateSettings() and connect() can both be called back-to-back within the
  // same handler (see ConnectScreen), before either state update has caused a
  // re-render - so a savePersisted() reading `matchAgent`/`user` straight out
  // of this closure would write stale values. These refs always hold the
  // latest value instead.
  const matchAgentRef = useRef(matchAgent);
  const userRef = useRef(user);
  const [rosterConfig, setRosterConfigState] = useState<RosterLockV1Config | null>(null);
  const [selection, setSelectionState] = useState<UserSelection | null>(null);
  const [match, setMatchState] = useState<MatchInfo | null>(null);
  const [downloadResult, setDownloadResultState] = useState<RosterLockV1SyncDLResult | null>(null);
  const [users, setUsersState] = useState<Array<RoomUser> | null>(null);
  const [gameSummary, setGameSummaryState] = useState<GameSummary | null>(null);

  function updateSettings(settings: MatchAgentConnection) {
    matchAgentRef.current = settings;
    setMatchAgentState(settings);
    setConnected(false);
    savePersisted({ matchAgent: settings, user: userRef.current });
  }

  async function connect(displayName: string) {
    const existingUser = userRef.current ?? {
      machineId: crypto.randomUUID(),
      displayName,
      keys: await generateKeyPair(),
    };
    userRef.current = existingUser;
    setUserState(existingUser);
    setConnected(true);
    savePersisted({ matchAgent: matchAgentRef.current, user: existingUser });
  }

  function setRosterConfig(config: RosterLockV1Config) {
    setRosterConfigState(config);
  }

  function setSelection(newSelection: UserSelection) {
    setSelectionState(newSelection);
  }

  function setMatch(newMatch: MatchInfo) {
    setMatchState(newMatch);
  }

  function setDownloadResult(result: RosterLockV1SyncDLResult, newUsers: Array<RoomUser>) {
    setDownloadResultState(result);
    setUsersState(newUsers);
  }

  function finishGame(summary: GameSummary) {
    setGameSummaryState(summary);
    setSelectionState(null);
    setMatchState(null);
    setDownloadResultState(null);
    setUsersState(null);
  }

  return (
    <GameSessionContext.Provider
      value={{
        matchAgent,
        connected,
        user,
        rosterConfig,
        selection,
        match,
        downloadResult,
        users,
        gameSummary,
        updateSettings,
        connect,
        setRosterConfig,
        setSelection,
        setMatch,
        setDownloadResult,
        finishGame,
      }}
    >
      {children}
    </GameSessionContext.Provider>
  );
}

export function useGameSession() {
  const context = useContext(GameSessionContext);
  if (!context) throw new Error("useGameSession must be used within GameSessionProvider");
  return context;
}
