
import { ArchiveHandler } from '../types';
import { TarArchiveWritable } from "./Writable";
export const tar: ArchiveHandler = {
  name: "tar",
  mimeType: ['application/x-tar'],
  signature: [{ offset: 257, bytes: [0x75, 0x73, 0x74, 0x61, 0x72] }],
  extractFiles: function () {
    return new TarArchiveWritable();
  }
};

