import { Client as FTPClient } from 'basic-ftp';

export async function checkIfDirectory(client: FTPClient, path: string): Promise<boolean> {
  try {
    // Try to list directory
    await client.list(path);
    return true;
  } catch {
    // If listing fails, assume it's a file
    return false;
  }
}

export class FTPError extends Error {
  constructor(
    public url: string,
    public originalError: any
  ) {
    super(`FTP error: ${originalError.message || originalError}`);
    this.name = 'FTPError';
  }
}