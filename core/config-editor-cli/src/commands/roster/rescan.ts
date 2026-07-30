import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";
import { parseKeyValueList } from "../../lib/parse";
import { scanPieceFolder } from "../../lib/piece-scan";

export const rescanCommand = withDraftOption(new Command("rescan"))
  .description(
    "Recompute an existing roster piece's asset hashes from its folder (e.g. after adding new asset files or " +
    "changing an asset definition), without touching its id, humanInfo, downloadSources, or requiredPieces"
  )
  .argument("<pieceType>", "the piece type key")
  .argument("<pieceId>", "the piece's id (as shown by \"roster list\")")
  .argument("[folder]", "path to the folder to scan (defaults to the folder used by the last \"roster add-piece\"/\"roster rescan\")")
  .option("--path-variables <k=v,...>", "path variable values used to resolve this piece's asset globs (defaults to the piece's existing path variables)")
  .action(withErrorHandling(async (pieceType: string, pieceId: string, folderArg: string | undefined, opts: {
    draft?: string, pathVariables?: string
  }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const pieceDefinition = draft.stagedLock.engine.pieceDefinitions[pieceType];
    if(!pieceDefinition) throw new Error(`Unknown piece type "${pieceType}"`);

    const collection = draft.stagedLock.rosters[pieceType];
    if(!collection) throw new Error(`Unknown piece type "${pieceType}"`);
    const piece = collection.find((p) => p.id === pieceId);
    if(!piece) throw new Error(`Unknown piece "${pieceId}" in "${pieceType}"`);

    const pieceInfo = draft.draft.rosterPieceInfo[pieceType]?.[pieceId];
    const folder = folderArg ?? pieceInfo?.referenceFolder;
    if(!folder){
      throw new Error(
        `No folder recorded for piece "${pieceId}"; pass one explicitly: ` +
        `roster rescan ${pieceType} ${pieceId} <folder>`
      );
    }

    const pathVariables = opts.pathVariables !== undefined ? parseKeyValueList(opts.pathVariables) : piece.pathVariables;
    const { version, errors } = await scanPieceFolder(folder, pathVariables, pieceDefinition);
    if(errors.length > 0){
      for(const err of errors) console.error(`[${err.type}] ${err.id}: ${err.message}`);
      throw new Error(`Folder does not match piece type "${pieceType}"'s asset definitions`);
    }

    const oldVersion = piece.version;
    piece.version = version;
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);

    draft.draft.rosterPieceInfo[pieceType] ??= {};
    draft.draft.rosterPieceInfo[pieceType][pieceId] = {
      referenceFolder: folder,
      testedDownloadSources: [],
    };

    writeDraft(draftPath, draft);
    console.log(
      `Rescanned piece "${pieceId}" in "${pieceType}": ` +
      `logic ${oldVersion.logic}->${version.logic}, media ${oldVersion.media}->${version.media}, docs ${oldVersion.docs}->${version.docs}`
    );
  }));
