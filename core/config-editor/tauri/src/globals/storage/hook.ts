import { useState, useEffect, useCallback, useMemo } from 'react';

import { TypedStorageService } from './typed';

/**
 * Generic hook for storage operations
 */

export function useStorage<T>(key: string) {
  const storageService = useMemo(() => new TypedStorageService<T>(key), [key]);
  const [value, setValue] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load value on mount
  useEffect(() => {
    const loadValue = async () => {
      try {
        setLoading(true);
        setError(null);
        const storedValue = await storageService.get();
        setValue(storedValue);
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to load`);
        setValue(null);
      } finally {
        setLoading(false);
      }
    };

    loadValue();
  }, [storageService]);

  const updateValue = useCallback(async (newValue: T) => {
    try {
      setError(null);
      await storageService.set(newValue);
      setValue(newValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to update`);
    }
  }, [storageService]);

  const removeValue = useCallback(async () => {
    try {
      setError(null);
      await storageService.remove();
      setValue(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to remove`);
    }
  }, [storageService]);

  return {
    value,
    loading,
    error,
    setValue: updateValue,
    removeValue,
  };
}
