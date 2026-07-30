import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA, validatePieceDefinition } from "@roster-lock/shared";
import { EngineAssetDefinition, AssetClassification } from "@roster-lock/types";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";
import { parseCount } from "../../lib/parse";

function collectGlob(value: string, previous: Array<string>){
  previous.push(value);
  return previous;
}

export const addAssetCommand = withDraftOption(new Command("add-asset"))
  .description("Add an asset definition to an existing piece type")
  .argument("<pieceType>", "the piece type key")
  .argument("<assetName>", "the asset's name")
  .requiredOption("--classification <classification>", "logic|media|doc")
  .requiredOption("--count <count>", "exact number, \"*\", or \"min:max\" (max may be \"*\")")
  .option("--glob <pattern>", "glob pattern (repeatable)", collectGlob, [] as Array<string>)
  .action(withErrorHandling(async (pieceType: string, assetName: string, opts: {
    draft?: string, classification: string, count: string, glob: Array<string>
  }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const definition = draft.stagedLock.engine.pieceDefinitions[pieceType];
    if(!definition) throw new Error(`Unknown piece type "${pieceType}"`);
    if(opts.glob.length === 0) throw new Error("At least one --glob is required");
    if(!["logic", "media", "doc"].includes(opts.classification)){
      throw new Error(`Invalid --classification "${opts.classification}" (expected logic|media|doc)`);
    }

    const asset: EngineAssetDefinition = {
      name: assetName,
      classification: opts.classification as AssetClassification,
      count: parseCount(opts.count),
      glob: opts.glob,
    };
    definition.assets.push(asset);
    validatePieceDefinition(pieceType, definition, draft.stagedLock.engine);
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);

    writeDraft(draftPath, draft);
    console.log(`Added asset "${assetName}" to piece type "${pieceType}"`);
  }));
