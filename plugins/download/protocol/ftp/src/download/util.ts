import { Client as FTPClient } from 'basic-ftp';

export async function checkIfDirectory(client: FTPClient, path: string): Promise<boolean> {
  try {
    // SIZE only succeeds for regular files — servers (including vsftpd)
    // reject it for directories, making it a reliable file/dir check.
    // LIST is not reliable here: many servers happily LIST a single file
    // path too, returning just that one entry, which made every file
    // download get misrouted into the directory-handling code path.
    await client.size(path);
    return false;
  } catch {
    return true;
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