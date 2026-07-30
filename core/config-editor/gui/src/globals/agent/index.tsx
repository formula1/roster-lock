import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type PropsWithChildren,
} from "react";
import { useHost } from "../Host";
import { type PluginFunctions } from "./types";

export * from "./types";

// Connection to a running match-agent - it backs the gui's plugin
// capabilities (running scripts, testing download sources). No agent
// connected simply means those features stay hidden. Settings persist via
// host.storage, so each host keeps them wherever it keeps everything else.

export type AgentSettings = { url: string, authCode: string };
export const DEFAULT_AGENT_URL = "http://localhost:58732";

const SETTINGS_KEY = "agent-settings";

function castSettings(value: unknown): AgentSettings | null {
  const parsed = value as { url?: unknown, authCode?: unknown } | null;
  if(typeof parsed?.url !== "string" || typeof parsed?.authCode !== "string") return null;
  return { url: parsed.url, authCode: parsed.authCode };
}

export async function validateAgent({ url, authCode }: AgentSettings): Promise<boolean> {
  const res = await fetch(new URL("/validate-authcode", url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ authCode }),
  });
  if(!res.ok) throw new Error(`Agent responded with ${res.status}`);
  return await res.json() === true;
}

function createAgentPlugins({ url, authCode }: AgentSettings): PluginFunctions {
  async function request(method: string, path: string, body?: unknown): Promise<Response> {
    const res = await fetch(new URL(path, url), {
      method,
      headers: {
        "Authorization": `Bearer ${authCode}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if(!res.ok){
      const message = await res.json().then(
        (json) => json?.error || res.statusText,
        () => res.statusText,
      );
      throw new Error(`Agent request failed (${res.status}): ${message}`);
    }
    return res;
  }

  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    return (await request(method, path, body)).json();
  }

  // Raw response bytes rather than JSON - ReadableStream async iteration is
  // still patchy across browsers, so read through a reader.
  async function* stream(path: string, body: unknown): AsyncIterable<Uint8Array> {
    const res = await request("POST", path, body);
    if(!res.body) throw new Error("Agent response had no body");
    const reader = res.body.getReader();
    try {
      while(true){
        const { done, value } = await reader.read();
        if(done) return;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  return {
    getDownloadPlugins: () => call("GET", "/editor/v1/plugins/download"),
    matchDownloadProtocols: (matchUrl) => call("POST", "/editor/v1/plugins/match-download-protocols", { url: matchUrl }),
    getScriptPlugins: () => call("GET", "/editor/v1/plugins/script"),
    runScript: (scriptConfig) => call("POST", "/editor/v1/run-script", scriptConfig),
    downloadSourceVersion: (args) => call("POST", "/editor/v1/download-source-version", args),
    createDownloadSession: (source) => call("POST", "/editor/v1/download-session", { source }),
    readDownloadSessionFile: (sessionId, relativePath) => (
      stream("/editor/v1/download-session/file", { sessionId, relativePath })
    ),
    closeDownloadSession: async (sessionId) => {
      await call("POST", "/editor/v1/download-session/close", { sessionId });
    },
    searchPieces: (query) => call("POST", "/editor/v1/pieces/search", query),
  };
}

export type AgentConnection = {
  settings: AgentSettings | null,
  status: "disconnected" | "connecting" | "connected" | "error",
  error: string | null,
  plugins: PluginFunctions | undefined,
  connect: (settings: AgentSettings) => Promise<void>,
  disconnect: () => void,
};

const AgentContext = createContext<AgentConnection | null>(null);

export function useAgentConnection(){
  const connection = useContext(AgentContext);
  if(!connection) throw new Error("useAgentConnection() outside of AgentConnectionProvider");
  return connection;
}

// The single access point for plugin capabilities - undefined until an agent
// is connected, and UI features gate on that.
export function usePlugins(): PluginFunctions | undefined {
  return useAgentConnection().plugins;
}

export function AgentConnectionProvider(props: PropsWithChildren){
  const host = useHost();
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [status, setStatus] = useState<AgentConnection["status"]>("disconnected");
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async (newSettings: AgentSettings) => {
    setStatus("connecting");
    setError(null);
    // Settings stick around even if validation fails, so the connection form
    // can offer a retry with them filled in.
    setSettings(newSettings);
    try {
      const valid = await validateAgent(newSettings);
      if(!valid) throw new Error("Agent rejected the auth code");
      await host.storage.set(SETTINGS_KEY, newSettings);
      setStatus("connected");
    }catch(e){
      setStatus("error");
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, [host]);

  const disconnect = useCallback(() => {
    host.storage.remove(SETTINGS_KEY).catch((e)=>{
      console.error("Failed to clear agent settings", e);
    });
    setSettings(null);
    setStatus("disconnected");
    setError(null);
  }, [host]);

  // Re-validate a persisted connection on startup.
  useEffect(() => {
    let cancelled = false;
    host.storage.get(SETTINGS_KEY).then((raw)=>{
      const persisted = castSettings(raw);
      if(!persisted || cancelled) return;
      return connect(persisted).catch(()=>{
        // status/error already reflect the failure - settings stay so the
        // user can retry from the connection form.
      });
    });
    return ()=>{ cancelled = true; };
  }, [host, connect]);

  const plugins = useMemo(() => (
    status === "connected" && settings ? createAgentPlugins(settings) : undefined
  ), [status, settings]);

  const value = useMemo<AgentConnection>(() => (
    { settings, status, error, plugins, connect, disconnect }
  ), [settings, status, error, plugins, connect, disconnect]);

  return <AgentContext.Provider value={value}>{props.children}</AgentContext.Provider>;
}
