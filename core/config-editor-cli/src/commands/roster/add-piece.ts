import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { join as pathJoin } from "node:path";
import {
  ROSTERLOCK_V1_CASTER_JSONSCHEMA,
  ROSTERLOCK_V1_PIECEINFO_CASTER_JSONSCHEMA,
  PATH_ROSTERLOCK_PIECE_INFO,
} from "@roster-lock/shared";
import { RosterLockPiece } from "@roster-lock/types";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";
import { parseKeyValueList } from "../../lib/parse";
import { scanPieceFolder } from "../../lib/piece-scan";
import { slugify } from "../../lib/slugify";
import { readJsonInput } from "../../lib/json-input";
import { pieceOverridesSchema } from "../../lib/schemas";
import { describeSchemaShape } from "../../lib/schema-help";

function collectSource(value: string, previous: Array<string>){
  previous.push(value);
  return previous;
}

export const addPieceCommand = withDraftOption(new Command("add-piece"))
  .description("Scan a folder and add it as a piece for an existing piece type")
  .argument("<pieceType>", "the piece type key")
  .argument("<folder>", "path to the folder to scan for the piece's assets")
  .option("--path-variables <k=v,...>", "path variable values used to resolve this piece's asset globs")
  .option("--download-source <url>", "download source url (repeatable)", collectSource, [] as Array<string>)
  .option(
    "--json <file>",
    "set humanInfo/downloadSources/pathVariables from a JSON file (or \"-\" for stdin), applied on top of a " +
    `rosterlock.piece-info.json in the folder if present. Shape: ${describeSchemaShape(pieceOverridesSchema)}`
  )
  .action(withErrorHandling(async (pieceType: string, folder: string, opts: {
    draft?: string, pathVariables?: string, downloadSource: Array<string>, json?: string
  }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const pieceDefinition = draft.stagedLock.engine.pieceDefinitions[pieceType];
    if(!pieceDefinition) throw new Error(`Unknown piece type "${pieceType}"; define it first with "engine add-piece-type"`);

    const pathVariables = parseKeyValueList(opts.pathVariables);
    const { version, errors } = await scanPieceFolder(folder, pathVariables, pieceDefinition);
    if(errors.length > 0){
      for(const err of errors) console.error(`[${err.type}] ${err.id}: ${err.message}`);
      throw new Error(`Folder does not match piece type "${pieceType}"'s asset definitions`);
    }

    const piece: RosterLockPiece = {
      id: "",
      version,
      humanInfo: { name: "", author: "", url: "" },
      downloadSources: [...opts.downloadSource],
      pathVariables,
      requiredPieces: Object.fromEntries(
        pieceDefinition.requires.map((requiredType) => [requiredType, { selectable: false, expected: [] }])
      ),
    };

    const metaPath = pathJoin(folder, PATH_ROSTERLOCK_PIECE_INFO);
    if(existsSync(metaPath)){
      const metaJson = JSON.parse(readFileSync(metaPath, "utf-8"));
      const meta = ROSTERLOCK_V1_PIECEINFO_CASTER_JSONSCHEMA.cast(metaJson, true);
      piece.humanInfo = meta.humanInfo;
      for(const source of meta.downloadSources){
        if(!piece.downloadSources.includes(source)) piece.downloadSources.push(source);
      }
    }

    if(opts.json){
      const overrides = await readJsonInput(opts.json, pieceOverridesSchema);
      if(overrides.humanInfo) piece.humanInfo = overrides.humanInfo;
      if(overrides.downloadSources){
        for(const source of overrides.downloadSources){
          if(!piece.downloadSources.includes(source)) piece.downloadSources.push(source);
        }
      }
      if(overrides.pathVariables) Object.assign(piece.pathVariables, overrides.pathVariables);
    }

    if(piece.downloadSources.length === 0){
      throw new Error(
        "At least one download source is required; pass --download-source or provide a rosterlock.piece-info.json with downloadSources"
      );
    }

    piece.id = piece.humanInfo.name
      ? `@${slugify(piece.humanInfo.author)}/${slugify(piece.humanInfo.name)}`
      : `#${version.logic}/${version.media}`;

    const collection = draft.stagedLock.rosters[pieceType] ?? (draft.stagedLock.rosters[pieceType] = []);
    if(collection.find((p) => p.id === piece.id)){
      throw new Error(`Piece "${piece.id}" already exists in "${pieceType}"; use "roster remove-piece" first`);
    }
    collection.push(piece);
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);

    draft.draft.rosterPieceInfo[pieceType] ??= {};
    draft.draft.rosterPieceInfo[pieceType][piece.id] = {
      referenceFolder: folder,
      testedDownloadSources: [],
    };

    writeDraft(draftPath, draft);
    console.log(`Added piece "${piece.id}" (logic=${version.logic}) to "${pieceType}"`);
  }));
