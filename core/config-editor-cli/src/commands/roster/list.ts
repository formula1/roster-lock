import { Command } from "commander";
import { resolveDraftPath, readDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";

export const rosterListCommand = withDraftOption(new Command("list"))
  .description("List pieces in the staged lock's rosters")
  .argument("[pieceType]", "the piece type key (defaults to listing every piece type's roster)")
  .action(withErrorHandling(async (pieceType: string | undefined, opts: { draft?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const collections = pieceType
      ? { [pieceType]: draft.stagedLock.rosters[pieceType] ?? [] }
      : draft.stagedLock.rosters;

    for(const [type, pieces] of Object.entries(collections)){
      console.log(`${type}:`);
      for(const piece of pieces){
        console.log(`  ${piece.id}  logic=${piece.version.logic.slice(0, 12)}  sources=${piece.downloadSources.length}`);
      }
    }
  }));
