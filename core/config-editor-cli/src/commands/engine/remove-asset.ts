import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";

export const removeAssetCommand = withDraftOption(new Command("remove-asset"))
  .description("Remove an asset definition from a piece type")
  .argument("<pieceType>", "the piece type key")
  .argument("<assetName>", "the asset's name")
  .action(withErrorHandling(async (pieceType: string, assetName: string, opts: { draft?: string }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const definition = draft.stagedLock.engine.pieceDefinitions[pieceType];
    if(!definition) throw new Error(`Unknown piece type "${pieceType}"`);
    const index = definition.assets.findIndex((a) => a.name === assetName);
    if(index === -1) throw new Error(`Unknown asset "${assetName}" on piece type "${pieceType}"`);

    definition.assets.splice(index, 1);
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);

    writeDraft(draftPath, draft);
    console.log(`Removed asset "${assetName}" from piece type "${pieceType}"`);
  }));
