import { Command } from "commander";
import { resolveDraftPath, readDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";

export const engineShowCommand = withDraftOption(new Command("show"))
  .description("Print the staged lock's engine config, or a single piece type")
  .argument("[pieceType]", "the piece type key (defaults to showing the whole engine config)")
  .action(withErrorHandling(async (pieceType: string | undefined, opts: { draft?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    if(pieceType){
      const definition = draft.stagedLock.engine.pieceDefinitions[pieceType];
      if(!definition) throw new Error(`Unknown piece type "${pieceType}"`);
      console.log(JSON.stringify(definition, null, 2));
      return;
    }
    console.log(JSON.stringify(draft.stagedLock.engine, null, 2));
  }));
