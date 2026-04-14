import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
// Types matching the Electron API
export interface DirEntry {
  name: string;
  is_directory: boolean;
  is_file: boolean;
}

export interface FileStat {
  size: number;
  is_directory: boolean;
  is_file: boolean;
  mtime: string;
  ctime: string;
}

export interface WalkResult {
  path: string;
  relative_path: string;
  is_directory: boolean;
  is_file: boolean;
  size: number;
}

export interface WalkStreamCallbacks {
  onData: (result: WalkResult) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}

// File system operations
export const fs = {
  async homeDir(): Promise<string> {
    return await invoke('fs_home_dir');
  },

  async readFile(path: string): Promise<Uint8Array> {
    const data: number[] = await invoke('fs_read_file', { path });
    return new Uint8Array(data);
  },

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    await invoke('fs_write_file', { path, data: Array.from(data) });
  },

  async removeFile(path: string): Promise<void> {
    await invoke('fs_remove_file', { path });
  },

  async mkdir(path: string): Promise<void> {
    await invoke('fs_mkdir', { path });
  },

  async mkdirAll(path: string): Promise<void> {
    await invoke('fs_mkdir_all', { path });
  },

  async exists(path: string): Promise<boolean> {
    return await invoke('fs_exists', { path });
  },

  async getHomeDir(): Promise<string> {
    return await invoke('fs_get_home_dir');
  },

  async getAppDataDir(): Promise<string> {
    return await invoke('fs_get_app_data_dir');
  },

  async getDocumentsDir(): Promise<string> {
    return await invoke('fs_get_documents_dir');
  },

  async getDownloadsDir(): Promise<string> {
    return await invoke('fs_get_downloads_dir');
  },

  async getMatchLockDir(): Promise<string> {
    return await invoke('fs_get_match_lock_dir');
  },

  async readDir(path: string): Promise<DirEntry[]> {
    return await invoke('fs_read_dir', { dirPath: path });
  },

  async stat(path: string): Promise<FileStat> {
    return await invoke('fs_stat', { filePath: path });
  },

  readJSON(path: string){
    return this.readFile(path).then(data => JSON.parse(new TextDecoder().decode(data)))
  },
  writeJSON(path: string, data: any){
    return this.writeFile(path, new TextEncoder().encode(JSON.stringify(data, null, 2)))
  },
  

  async walkDir(path: string): Promise<WalkResult[]> {
    // For compatibility, we'll collect all results from the stream
    return new Promise((resolve, reject) => {
      const results: WalkResult[] = [];
      fs.startWalkStream(path, {
        onData: (result) => results.push(result),
        onError: (error) => reject(new Error(error)),
        onEnd: () => resolve(results),
      });
    });
  },

  async startWalkStream(path: string, callbacks: WalkStreamCallbacks): Promise<void>{
    const streamId = `walk-${Date.now().toString(32)}-${Math.random().toString(32).substring(2)}`;
    
    // Set up event listeners
    const unlistenData = await listen(`fs-walk-stream-data-${streamId}`, (event) => {
      callbacks.onData(event.payload as WalkResult);
    });

    const unlistenError = await listen(`fs-walk-stream-error-${streamId}`, (event) => {
      callbacks.onError(event.payload as string);
      unlistenData();
      unlistenError();
      unlistenEnd();
    });

    const unlistenEnd = await listen(`fs-walk-stream-end-${streamId}`, () => {
      callbacks.onEnd();
      unlistenData();
      unlistenError();
      unlistenEnd();
    });

    // Start the stream
    await invoke('fs_start_walk_stream', { dirPath: path, streamId });
  },

  walkDirStream: async function*(path: string): AsyncIterable<WalkResult> {
    const streamId = `walk-${Date.now().toString(32)}-${Math.random().toString(32).substring(2)}`;

    const queue: WalkResult[] = [];
    let done = false;
    let error: Error | null = null;
    let resolver: (() => void) | null = null;

    const notify = () => {
      if (resolver) {
        resolver();
        resolver = null;
      }
    };

    const waitForData = () => new Promise<void>((resolve) => {
      resolver = resolve;
    });

    // Set up event listeners
    const unlistenData = await listen(`fs-walk-stream-data-${streamId}`, (event) => {
      queue.push(event.payload as WalkResult);
      notify();
    });

    const unlistenError = await listen(`fs-walk-stream-error-${streamId}`, (event) => {
      error = new Error(event.payload as string);
      done = true;
      notify();
    });

    const unlistenEnd = await listen(`fs-walk-stream-end-${streamId}`, () => {
      done = true;
      notify();
    });

    const cleanup = () => {
      unlistenData();
      unlistenError();
      unlistenEnd();
    };

    try {
      // Start the stream
      await invoke('fs_start_walk_stream', { dirPath: path, streamId });

      while (true) {
        while (queue.length > 0) yield queue.shift()!;

        if (error)  throw error;

        if (done) return;

        await waitForData();
      }
    } finally {
      cleanup();
    }
  },

  getFileStream: async function*(
    path: string, options: Partial<{ chunkSize: number, abortSignal?: AbortSignal }> = {}
  ): AsyncIterable<Uint8Array>{
    const chunkSize = options.chunkSize || 1024 * 1024;
    const abortSignal = options.abortSignal;
    if(abortSignal?.aborted) return;

    let offset = 0;
    try {
      while(true){
        const chunk = await invoke<number[]>('fs_read_file_chunk', { 
          path,
          offset,
          length: chunkSize
        });
        if(abortSignal?.aborted) return;

        if (chunk.length === 0) {
          // EOF
          return;
        }

        yield new Uint8Array(chunk);
        offset += chunk.length;

        // If we got less than requested, we're at EOF
        if (chunk.length < chunkSize) {
          return;
        }
      }
    } catch (error) {
      throw new Error(`Failed to read file at offset ${offset}: ${error}`);
    }
  }

};
