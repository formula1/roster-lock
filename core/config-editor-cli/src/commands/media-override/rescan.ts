import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";
import { scanMediaOverrideFolder } from "../../lib/media-override-scan";

export const rescanMediaOverrideCommand = withDraftOption(new Command("rescan"))
  .description(
    "Recompute a media override's content hash from its folder (e.g. after changing its asset files). Since the " +
    "hash is the override's own map key, this moves the entry to a new key rather than mutating one in place"
  )
  .argument("<pieceType>", "the piece type key")
  .argument("<pieceId>", "the roster piece this override applies to")
  .argument("<overrideHash>", "the override's current content hash")
  .argument("[folder]", "path to the folder to scan (defaults to the folder used by the last add/rescan)")
  .action(withErrorHandling(async (pieceType: string, pieceId: string, overrideHash: string, folderArg: string | undefined, opts: {
    draft?: string
  }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const pieceDefinition = draft.stagedLock.engine.pieceDefinitions[pieceType];
    if(!pieceDefinition) throw new Error(`Unknown piece type "${pieceType}"`);
    const rosterPiece = draft.stagedLock.rosters[pieceType]?.find((p) => p.id === pieceId);
    if(!rosterPiece) throw new Error(`Unknown piece "${pieceId}" in "${pieceType}"`);
    const logicHash = rosterPiece.version.logic;

    const overridesForPiece = draft.stagedLock.mediaOverrides?.[pieceType]?.[logicHash];
    const entry = overridesForPiece?.[overrideHash];
    if(!overridesForPiece || !entry){
      throw new Error(`Unknown media override "${overrideHash}" for "${pieceId}" in "${pieceType}"`);
    }

    const infoForPiece = draft.draft.mediaOverrideInfo?.[pieceType]?.[logicHash];
    const info = infoForPiece?.[overrideHash];
    const folder = folderArg ?? info?.referenceFolder;
    if(!folder){
      throw new Error(
        `No folder recorded for override "${overrideHash}"; pass one explicitly: ` +
        `media-override rescan ${pieceType} ${pieceId} ${overrideHash} <folder>`
      );
    }

    const { hash, errors } = await scanMediaOverrideFolder(
      folder, rosterPiece.pathVariables, pieceDefinition, entry.assets
    );
    if(errors.length > 0){
      for(const err of errors) console.error(`[${err.type}] ${err.id}: ${err.message}`);
      throw new Error("Folder does not match this override's declared assets");
    }
    if(hash !== overrideHash && overridesForPiece[hash]){
      throw new Error(`Media override "${hash}" already exists for "${pieceId}"; remove it first`);
    }

    delete overridesForPiece[overrideHash];
    overridesForPiece[hash] = entry;
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);

    if(infoForPiece) delete infoForPiece[overrideHash];
    draft.draft.mediaOverrideInfo ??= {};
    draft.draft.mediaOverrideInfo[pieceType] ??= {};
    draft.draft.mediaOverrideInfo[pieceType][logicHash] ??= {};
    draft.draft.mediaOverrideInfo[pieceType][logicHash][hash] = {
      referenceFolder: folder,
      testedDownloadSources: [],
    };

    writeDraft(draftPath, draft);
    console.log(`Rescanned media override for "${pieceId}" in "${pieceType}": ${overrideHash} -> ${hash}`);
  }));
