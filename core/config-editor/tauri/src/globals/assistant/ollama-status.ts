import { useState, useEffect, useCallback } from "react";
import { checkOllamaStatus } from "./ollama-client";

export type OllamaStatus = "checking" | "available" | "unavailable";

// Poll faster while connected (so a disconnect is noticed quickly) and back
// off while disconnected (no point hammering a server that isn't there).
const AVAILABLE_POLL_INTERVAL_MS = 15000;
const UNAVAILABLE_POLL_INTERVAL_MS = 500;

export function useOllamaStatus(baseUrl: string) {
  const [status, setStatus] = useState<OllamaStatus>("checking");
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const check = useCallback(async () => {
    setStatus("checking");
    const result = await checkOllamaStatus(baseUrl);
    setStatus(result.available ? "available" : "unavailable");
    setError(result.error ?? null);
    setLastChecked(new Date());
    return result.available;
  }, [baseUrl]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const loop = async () => {
      const available = await check();
      if (cancelled) return;
      timeoutId = setTimeout(loop, available ? AVAILABLE_POLL_INTERVAL_MS : UNAVAILABLE_POLL_INTERVAL_MS);
    };
    loop();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [check]);

  const recheck = useCallback(() => { check(); }, [check]);

  return { status, error, lastChecked, recheck };
}
