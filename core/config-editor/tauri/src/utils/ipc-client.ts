import { invoke } from '@tauri-apps/api/core';

/**
 * Simple IPC client for making requests to the Node.js IPC server via Tauri
 */
export class IPCClient {
  /**
   * Make a generic IPC request
   */
  private static async request(method: string, path: string, body?: any): Promise<any> {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    
    try {
      const response = await invoke('ipc_request', {
        method,
        path,
        body: bodyStr,
      }) as string;
      
      return JSON.parse(response);
    } catch (error) {
      console.error(`IPC ${method} ${path} failed:`, error);
      throw error;
    }
  }

  /**
   * Make a GET request
   */
  static async get(path: string): Promise<any> {
    return this.request('GET', path);
  }

  /**
   * Make a POST request
   */
  static async post(path: string, body?: any): Promise<any> {
    return this.request('POST', path, body);
  }

  /**
   * Make a PUT request
   */
  static async put(path: string, body?: any): Promise<any> {
    return this.request('PUT', path, body);
  }

  /**
   * Make a DELETE request
   */
  static async delete(path: string): Promise<any> {
    return this.request('DELETE', path);
  }

  // Convenience methods for common operations

  /**
   * Storage operations
   */
  static storage = {
    get: (key: string) => this.get(`/storage/${key}`),
    set: (key: string, value: any) => this.post(`/storage/${key}`, { value }),
    remove: (key: string) => this.delete(`/storage/${key}`),
    keys: () => this.get('/storage/keys'),
    clear: () => this.post('/storage/clear'),
  };

  /**
   * User settings operations
   */
  static userSettings = {
    get: () => this.get('/user-settings'),
    update: (settings: any) => this.post('/user-settings', settings),
    initialize: () => this.post('/user-settings/initialize'),
    handleChoice: (choice: string, matchLockDir: string) => 
      this.post('/user-settings/handle-choice', { choice, matchLockDir }),
  };

  /**
   * Health check
   */
  static health = () => this.get('/health');
}
