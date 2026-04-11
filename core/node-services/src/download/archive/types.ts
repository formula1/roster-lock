
import { FileSignature } from "../types";
import { Writable, Readable } from "node:stream";
import { ISimpleEventEmitter } from "@roster-lock/shared";

export type ArchiveWritable = Writable & { onFile: ISimpleEventEmitter<[path: string, contents: Readable]> };

export type ArchiveHandler = {
  name: string;
  mimeType: Array<string>;
  signature: Array<FileSignature>;
  extractFiles: ()=>ArchiveWritable;
};

