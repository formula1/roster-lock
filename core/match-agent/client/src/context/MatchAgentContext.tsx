import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { validateAuthCode } from "@roster-lock/ts-client";

export type MatchAgentSettings = {
  url: string,
  authCode: string,
};

const DEFAULT_SETTINGS: MatchAgentSettings = {
  url: "http://localhost:58732",
  authCode: "",
};

const STORAGE_KEY = "match-agent-client:match-agent";

function loadSettings(): MatchAgentSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

type MatchAgentContextValue = {
  settings: MatchAgentSettings,
  connected: boolean,
  connecting: boolean,
  error: string | null,
  updateSettings: (settings: MatchAgentSettings) => void,
  connect: () => Promise<void>,
};

const MatchAgentContext = createContext<MatchAgentContextValue | null>(null);

export function MatchAgentProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<MatchAgentSettings>(loadSettings);
  // Deliberately not persisted, same reasoning as game-pwa's GameSessionContext:
  // a stale/rotated auth code should always be re-checked on load, not assumed.
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSettings = useCallback((next: MatchAgentSettings) => {
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setConnected(false);
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const ok = await validateAuthCode(settings.authCode, settings.url);
      setConnected(Boolean(ok));
      if (!ok) setError("Auth code was rejected by match-agent");
    } catch (e) {
      setConnected(false);
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }, [settings]);

  return (
    <MatchAgentContext.Provider value={{ settings, connected, connecting, error, updateSettings, connect }}>
      {children}
    </MatchAgentContext.Provider>
  );
}

export function useMatchAgent(): MatchAgentContextValue {
  const ctx = useContext(MatchAgentContext);
  if (!ctx) throw new Error("useMatchAgent must be used within a MatchAgentProvider");
  return ctx;
}
