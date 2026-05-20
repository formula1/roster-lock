

export class IPFSError extends Error {
  constructor(
    public cid: string,
    public originalError: any
  ) {
    super(`IPFS error: ${originalError.message || originalError}`);
    this.name = 'IPFSError';
  }
}
