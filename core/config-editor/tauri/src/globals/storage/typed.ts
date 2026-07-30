import { nativeAPI } from "../../tauri";

export class TypedStorageService<T> {
  private key: string;

  constructor(key: string) {
    this.key = key;
  }

  /**
   * Generic storage methods for other data
   */
  async get(): Promise<T | null> {
    return await nativeAPI.storage.get(this.key) as T | null;
  }

  async set(value: T): Promise<void> {
    await nativeAPI.storage.set(this.key, value);
  }

  async remove(): Promise<void> {
    await nativeAPI.storage.remove(this.key);
  }

  async exists(): Promise<boolean> {
    const value = await nativeAPI.storage.get(this.key);
    return value !== null;
  }

  async keys(): Promise<string[]> {
    return nativeAPI.storage.keys();
  }

  async clear(): Promise<void> {
    await nativeAPI.storage.clear();
  }
}
