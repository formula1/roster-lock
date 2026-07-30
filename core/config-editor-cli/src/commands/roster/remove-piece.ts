import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";

export const removePieceCommand = withDraftOption(new Command("remove-piece"))
  .description("Remove a piece from the staged lock's rosters")
  .argument("<pieceType>", "the piece type key")
  .argument("<pieceId>", "the piece's id (as shown by \"roster list\")")
  .action(withErrorHandling(async (pieceType: string, pieceId: string, opts: { draft?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const collection = draft.stagedLock.rosters[pieceType];
    if(!collection) throw new Error(`Unknown piece type "${pieceType}"`);
    const index = collection.findIndex((p) => p.id === pieceId);
    if(index === -1) throw new Error(`Unknown piece "${pieceId}" in "${pieceType}"`);

    collection.splice(index, 1);
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);

    const pieceInfo = draft.draft.rosterPieceInfo[pieceType];
    if(pieceInfo) delete pieceInfo[pieceId];

    writeDraft(draftPath, draft);
    console.log(`Removed piece "${pieceId}" from "${pieceType}"`);
  }));
