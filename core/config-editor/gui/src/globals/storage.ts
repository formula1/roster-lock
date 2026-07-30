import { useState, useEffect, useCallback } from "react";
import type { JSON_Unknown } from "@roster-lock/utils";
import { useHost } from "./Host";

// React wrapper over host.storage - loads once per key, then keeps local
// state in sync with writes made through this hook.
export function useHostStorage<T extends JSON_Unknown>(key: string){
  const host = useHost();
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    host.storage.get(key).then(
      (storedValue) => {
        if(!active) return;
        setValue(storedValue as T | null);
        setLoading(false);
      },
      (err) => {
        if(!active) return;
        setError(err instanceof Error ? err.message : "Failed to load");
        setValue(null);
        setLoading(false);
      },
    );
    return () => { active = false; };
  }, [host, key]);

  const updateValue = useCallback(async (newValue: T) => {
    try {
      setError(null);
      await host.storage.set(key, newValue);
      setValue(newValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  }, [host, key]);

  const removeValue = useCallback(async () => {
    try {
      setError(null);
      await host.storage.remove(key);
      setValue(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    }
  }, [host, key]);

  return {
    value,
    loading,
    error,
    setValue: updateValue,
    removeValue,
  };
}
