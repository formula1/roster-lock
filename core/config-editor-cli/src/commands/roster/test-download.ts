import { Command } from "commander";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as pathJoin } from "node:path";
import { downloadToFolder, DEFAULT_PLUGIN_DIR } from "@roster-lock/plugin-runtime";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";
import { scanPieceFolder } from "../../lib/piece-scan";

export const testDownloadCommand = withDraftOption(new Command("test-download"))
  .description("Download a source over the network, verify its hash matches the piece, and record the test")
  .argument("<pieceType>", "the piece type key")
  .argument("<pieceId>", "the piece's id (as shown by \"roster list\")")
  .argument("<sourceUrl>", "download source url to fetch and verify")
  .action(withErrorHandling(async (pieceType: string, pieceId: string, sourceUrl: string, opts: { draft?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const pieceDefinition = draft.stagedLock.engine.pieceDefinitions[pieceType];
    if(!pieceDefinition) throw new Error(`Unknown piece type "${pieceType}"`);
    const piece = draft.stagedLock.rosters[pieceType]?.find((p) => p.id === pieceId);
    if(!piece) throw new Error(`Unknown piece "${pieceId}" in "${pieceType}"`);

    const tempDir = await mkdtemp(pathJoin(tmpdir(), "rosterlock-test-download-"));
    try {
      const { finishPromise } = await downloadToFolder(DEFAULT_PLUGIN_DIR, {
        url: sourceUrl,
        destinationFolder: tempDir,
        processHandlers: {
          abortSignal: new AbortController().signal,
          onProgress: (progress, total) => {
            process.stderr.write(`\rDownloading... ${progress}${total ? `/${total}` : ""}`);
          },
        },
      });
      await finishPromise;
      process.stderr.write("\n");

      const { version, errors } = await scanPieceFolder(tempDir, piece.pathVariables, pieceDefinition);
      if(errors.length > 0){
        for(const err of errors) console.error(`[${err.type}] ${err.id}: ${err.message}`);
        throw new Error("Downloaded folder does not match the piece type's asset definitions");
      }

      if(
        version.logic !== piece.version.logic ||
        version.media !== piece.version.media ||
        version.docs !== piece.version.docs
      ){
        console.error("Version mismatch:");
        console.error(`  expected: ${JSON.stringify(piece.version)}`);
        console.error(`  actual:   ${JSON.stringify(version)}`);
        throw new Error(`Downloaded source does not match the recorded version for "${pieceId}"`);
      }

      if(!piece.downloadSources.includes(sourceUrl)){
        piece.downloadSources.push(sourceUrl);
      }

      draft.draft.rosterPieceInfo[pieceType] ??= {};
      const pieceInfo = draft.draft.rosterPieceInfo[pieceType][pieceId] ?? (
        draft.draft.rosterPieceInfo[pieceType][pieceId] = { testedDownloadSources: [] }
      );
      pieceInfo.testedDownloadSources.push({
        source: sourceUrl,
        testedAt: Date.now(),
        version,
      });

      writeDraft(draftPath, draft);
      console.log(`Verified download source for "${pieceId}"`);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }));
