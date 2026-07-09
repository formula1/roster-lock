import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";

export const removePieceTypeCommand = withDraftOption(new Command("remove-piece-type"))
  .description("Remove a piece type definition from the staged lock's engine")
  .argument("<pieceType>", "the piece type key")
  .action(withErrorHandling(async (pieceType: string, opts: { draft?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    if(!draft.stagedLock.engine.pieceDefinitions[pieceType]){
      throw new Error(`Unknown piece type "${pieceType}"`);
    }
    const existingPieces = draft.stagedLock.rosters[pieceType];
    if(existingPieces && existingPieces.length > 0){
      throw new Error(`Piece type "${pieceType}" still has pieces in its roster; remove them first with "roster remove-piece"`);
    }
    delete draft.stagedLock.engine.pieceDefinitions[pieceType];
    delete draft.stagedLock.rosters[pieceType];
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);

    writeDraft(draftPath, draft);
    console.log(`Removed piece type: ${pieceType}`);
  }));
