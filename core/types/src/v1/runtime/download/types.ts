import { Decompressor } from "./Decompressor";
import { ArchiveHandler } from "./Archive";

export type Processors = {
  decompressors: Array<Decompressor>;
  archiveHandler: ArchiveHandler;
};

export type ProcessHandlers = {
  onProgress?: (progress: number, total?: number) => void;
  abortSignal: AbortSignal;
  getProcessors: (pathname: string) => Processors;
};

export type FileSignature = {
  offset: number;
  bytes: number[];
};
