import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { generateKeyPair, UserKeyPair } from "@roster-lock/ts-client";

const STORAGE_KEY = "match-agent-client:identity";

type StoredIdentity = { machineId: string, keys: UserKeyPair };

function loadStored(): StoredIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

type IdentityContextValue = {
  machineId: string,
  keys: UserKeyPair,
};

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<StoredIdentity | null>(loadStored);
  const generating = useRef(false);

  useEffect(() => {
    if (identity || generating.current) return;
    generating.current = true;
    generateKeyPair().then((keys) => {
      const next = { machineId: crypto.randomUUID(), keys };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setIdentity(next);
    });
  }, [identity]);

  // Blocks children until the one-time (sub-second) keypair generation
  // completes, rather than threading a loading state through every consumer.
  if (!identity) return null;

  return (
    <IdentityContext.Provider value={{ machineId: identity.machineId, keys: identity.keys }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity(): IdentityContextValue {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error("useIdentity must be used within an IdentityProvider");
  return ctx;
}
