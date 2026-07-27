import { createContext, useContext, useState, ReactNode } from "react";
import {
  RosterLockV1Config,
  RosterLockV1SyncDLResult,
  UserSelection,
} from "@roster-lock/types";
import { generateKeyPair, UserKeyPair } from "@roster-lock/ts-client";

export type MatchAgentConnection = {
  url: string;
  authCode: string;
  // The matchmaking service is a separate service from the match agent
  // (game-headless reads it from a distinct PUBLIC_MATCHMAKER_URL env var) -
  // kept alongside the match agent fields here since there's nowhere else
  // for a browser session to get it from.
  matchmakerUrl: string;
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
  matchAgent: MatchAgentConnection | null;
  user: CurrentUser | null;
  rosterConfig: RosterLockV1Config | null;
  selection: UserSelection | null;
  match: MatchInfo | null;
  downloadResult: RosterLockV1SyncDLResult | null;
  users: Array<RoomUser> | null;
  gameSummary: GameSummary | null;

  connect: (connection: MatchAgentConnection, displayName: string) => Promise<void>;
  setRosterConfig: (config: RosterLockV1Config) => void;
  setSelection: (selection: UserSelection) => void;
  setMatch: (match: MatchInfo) => void;
  setDownloadResult: (result: RosterLockV1SyncDLResult, users: Array<RoomUser>) => void;
  finishGame: (summary: GameSummary) => void;
};

const GameSessionContext = createContext<GameSessionContextType | undefined>(undefined);

export function GameSessionProvider({ children }: { children: ReactNode }) {
  const persisted = loadPersisted();

  const [matchAgent, setMatchAgentState] = useState<MatchAgentConnection | null>(persisted.matchAgent);
  const [user, setUserState] = useState<CurrentUser | null>(persisted.user);
  const [rosterConfig, setRosterConfigState] = useState<RosterLockV1Config | null>(null);
  const [selection, setSelectionState] = useState<UserSelection | null>(null);
  const [match, setMatchState] = useState<MatchInfo | null>(null);
  const [downloadResult, setDownloadResultState] = useState<RosterLockV1SyncDLResult | null>(null);
  const [users, setUsersState] = useState<Array<RoomUser> | null>(null);
  const [gameSummary, setGameSummaryState] = useState<GameSummary | null>(null);

  async function connect(connection: MatchAgentConnection, displayName: string) {
    const existingUser = user ?? {
      machineId: crypto.randomUUID(),
      displayName,
      keys: await generateKeyPair(),
    };
    setMatchAgentState(connection);
    setUserState(existingUser);
    savePersisted({ matchAgent: connection, user: existingUser });
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
        user,
        rosterConfig,
        selection,
        match,
        downloadResult,
        users,
        gameSummary,
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
