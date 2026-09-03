import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type InputSource = (
  | { type: "keyboard" }
  | { type: "gamepad", index: number }
);

export type PlayerSlot = {
  id: string,
  label: string,
  input: InputSource,
};

const STORAGE_KEY = "match-agent-client:join-settings";

function defaultSlots(): Array<PlayerSlot> {
  return [{ id: crypto.randomUUID(), label: "Player 1", input: { type: "keyboard" } }];
}

function loadSlots(): Array<PlayerSlot> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSlots();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultSlots();
  } catch {
    return defaultSlots();
  }
}

type JoinSettingsContextValue = {
  playerSlots: Array<PlayerSlot>,
  addSlot: () => void,
  removeSlot: (id: string) => void,
  setSlotInput: (id: string, input: InputSource) => void,
  setSlotLabel: (id: string, label: string) => void,
};

const JoinSettingsContext = createContext<JoinSettingsContextValue | null>(null);

export function JoinSettingsProvider({ children }: { children: ReactNode }) {
  const [playerSlots, setPlayerSlots] = useState<Array<PlayerSlot>>(loadSlots);

  const persist = useCallback((next: Array<PlayerSlot>) => {
    setPlayerSlots(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  // Only one slot may use the keyboard at a time - a browser only exposes
  // one keyboard, so there's no way to distinguish which slot a keypress was
  // meant for if more than one claims it. Additional local players need a
  // gamepad (see useGamepads/JoinSettings page).
  const addSlot = useCallback(() => {
    persist([...playerSlots, {
      id: crypto.randomUUID(), label: `Player ${playerSlots.length + 1}`, input: { type: "gamepad", index: 0 },
    }]);
  }, [playerSlots, persist]);

  const removeSlot = useCallback((id: string) => {
    const next = playerSlots.filter((s) => s.id !== id);
    persist(next.length > 0 ? next : defaultSlots());
  }, [playerSlots, persist]);

  const setSlotInput = useCallback((id: string, input: InputSource) => {
    persist(playerSlots.map((s) => (s.id === id ? { ...s, input } : s)));
  }, [playerSlots, persist]);

  const setSlotLabel = useCallback((id: string, label: string) => {
    persist(playerSlots.map((s) => (s.id === id ? { ...s, label } : s)));
  }, [playerSlots, persist]);

  return (
    <JoinSettingsContext.Provider value={{ playerSlots, addSlot, removeSlot, setSlotInput, setSlotLabel }}>
      {children}
    </JoinSettingsContext.Provider>
  );
}

export function useJoinSettings(): JoinSettingsContextValue {
  const ctx = useContext(JoinSettingsContext);
  if (!ctx) throw new Error("useJoinSettings must be used within a JoinSettingsProvider");
  return ctx;
}
