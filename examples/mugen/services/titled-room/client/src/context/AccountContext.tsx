import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import * as authApi from "../api/auth";
import { UserProfile } from "../api/auth";
import * as bridge from "../bridge";
import { AUTH_SERVICE_URL } from "../config";

const STORAGE_KEY = "titled-room-client:token";

type Identity = { publicKey: string, machineId: string, playerCount: number };

type AccountContextValue = {
  token: string | null,
  profile: UserProfile | null,
  identity: Identity | null,
  loading: boolean,
  error: string | null,
  register: (username: string, password: string) => Promise<void>,
  login: (username: string, password: string) => Promise<void>,
  logout: () => void,
  setDisplayName: (displayName: string) => Promise<void>,
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pulls this machine's public key/player count from the host (never a
  // private key - see api/bridge and core/types' matchmaker-bridge docs) and
  // registers them with the account if they're missing or stale. Runs once
  // per successful login/token restore.
  const syncIdentity = useCallback(async (activeToken: string) => {
    const id = await bridge.getIdentity();
    setIdentity(id);
    const current = await authApi.verify(AUTH_SERVICE_URL, activeToken);
    if (current.publicKey !== id.publicKey) {
      await authApi.setPublicKey(AUTH_SERVICE_URL, activeToken, id.publicKey);
    }
    if (current.playerCount !== id.playerCount) {
      await authApi.setPlayers(AUTH_SERVICE_URL, activeToken, id.playerCount);
    }
    setProfile(await authApi.verify(AUTH_SERVICE_URL, activeToken));
  }, []);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    syncIdentity(token).catch((e) => setError((e as Error).message)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const register = useCallback(async (username: string, password: string) => {
    await authApi.register(AUTH_SERVICE_URL, username, password);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const newToken = await authApi.login(AUTH_SERVICE_URL, username, password);
      localStorage.setItem(STORAGE_KEY, newToken);
      setToken(newToken);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setProfile(null);
    setIdentity(null);
  }, []);

  const setDisplayName = useCallback(async (displayName: string) => {
    if (!token) throw new Error("Not logged in");
    const { displayName: tag } = await authApi.setDisplayName(AUTH_SERVICE_URL, token, displayName);
    setProfile((prev) => prev && { ...prev, displayName: tag });
  }, [token]);

  return (
    <AccountContext.Provider value={{
      token, profile, identity, loading, error, register, login, logout, setDisplayName,
    }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountContextValue {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within an AccountProvider");
  return ctx;
}
