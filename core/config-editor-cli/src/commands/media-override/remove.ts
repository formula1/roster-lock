import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";

export const removeMediaOverrideCommand = withDraftOption(new Command("remove"))
  .description("Remove a media override from the staged lock")
  .argument("<pieceType>", "the piece type key")
  .argument("<pieceId>", "the roster piece this override applies to")
  .argument("<overrideHash>", "the override's content hash (as shown by \"media-override add\"/\"rescan\")")
  .action(withErrorHandling(async (pieceType: string, pieceId: string, overrideHash: string, opts: { draft?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const rosterPiece = draft.stagedLock.rosters[pieceType]?.find((p) => p.id === pieceId);
    if(!rosterPiece) throw new Error(`Unknown piece "${pieceId}" in "${pieceType}"`);
    const logicHash = rosterPiece.version.logic;
    const overridesForPiece = draft.stagedLock.mediaOverrides?.[pieceType]?.[logicHash];
    if(!overridesForPiece || !(overrideHash in overridesForPiece)){
      throw new Error(`Unknown media override "${overrideHash}" for "${pieceId}" in "${pieceType}"`);
    }

    delete overridesForPiece[overrideHash];
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);

    const infoForPiece = draft.draft.mediaOverrideInfo?.[pieceType]?.[logicHash];
    if(infoForPiece) delete infoForPiece[overrideHash];

    writeDraft(draftPath, draft);
    console.log(`Removed media override "${overrideHash}" from "${pieceId}" in "${pieceType}"`);
  }));
