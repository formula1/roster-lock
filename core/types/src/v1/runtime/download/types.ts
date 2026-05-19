

export type ProcessHandlers = {
  onProgress?: (progress: number, total?: number) => void;
  abortSignal: AbortSignal;
};

export type FileSignature = {
  offset: number;
  bytes: number[];
};
