import { Decompressor, ArchiveHandler, Processors } from '@roster-lock/types';
import { basename } from 'node:path';
import { getPluginModulesOfType } from "../plugin-management";

export function createGetProcessors(
  decompressors: Array<Decompressor>,
  archiveHandlers: Array<ArchiveHandler>
): (pathname: string) => Processors {
  return function getProcessors(pathname: string): Processors {
    const parts = basename(pathname).split('.');
    parts.shift(); // remove the base name before the first dot
    parts.reverse(); // outermost extension first

    const matchedDecompressors: Decompressor[] = [];

    while (parts.length > matchedDecompressors.length + 1) {
      const ext = parts[matchedDecompressors.length];
      const decompressor = decompressors.find(d => d.extensions.includes(`.${ext}`));
      if (!decompressor) break;
      matchedDecompressors.push(decompressor);
    }

    const archiveExt = parts[matchedDecompressors.length];
    if (!archiveExt) {
      throw new Error(`No extension found for archive handler in: ${pathname}`);
    }

    const archiveHandler = archiveHandlers.find(h => h.extensions.includes(`.${archiveExt}`));
    if (!archiveHandler) {
      throw new Error(`No archive handler found for extension .${archiveExt} in: ${pathname}`);
    }

    return {
      decompressors: matchedDecompressors,
      archiveHandler,
    };
  };
}
