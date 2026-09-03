import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";
import { parseKeyValueList } from "../../lib/parse";
import { readJsonInput } from "../../lib/json-input";
import { pieceOverridesSchema } from "../../lib/schemas";
import { describeSchemaShape } from "../../lib/schema-help";
import { encodeImageFile } from "../../lib/image";

function collect(value: string, previous: Array<string>){
  previous.push(value);
  return previous;
}

export const editPieceCommand = withDraftOption(new Command("edit-piece"))
  .description("Edit an existing roster piece's human info, download sources, or path variables")
  .argument("<pieceType>", "the piece type key")
  .argument("<pieceId>", "the piece's id (as shown by \"roster list\")")
  .option("--name <name>", "human-readable name")
  .option("--author <author>", "author name")
  .option("--url <url>", "info url")
  .option("--image <path>", "path to a local image file (png/jpg/gif/webp/svg) to embed, or \"-\" to remove it")
  .option("--add-download-source <url>", "download source url to add (repeatable)", collect, [] as Array<string>)
  .option("--remove-download-source <url>", "download source url to remove (repeatable)", collect, [] as Array<string>)
  .option("--path-variables <k=v,...>", "path variable values to set (existing keys not mentioned are left alone)")
  .option("--remove-path-variable <name>", "path variable name to remove (repeatable)", collect, [] as Array<string>)
  .option(
    "--json <file>",
    "bulk-set humanInfo/downloadSources/pathVariables from a JSON file (or \"-\" for stdin), applied before the " +
    `flags above (so a specific flag always wins over --json). Shape: ${describeSchemaShape(pieceOverridesSchema)}`
  )
  .action(withErrorHandling(async (pieceType: string, pieceId: string, opts: {
    draft?: string,
    name?: string, author?: string, url?: string, image?: string,
    addDownloadSource: Array<string>, removeDownloadSource: Array<string>,
    pathVariables?: string, removePathVariable: Array<string>,
    json?: string,
  }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const collection = draft.stagedLock.rosters[pieceType];
    if(!collection) throw new Error(`Unknown piece type "${pieceType}"`);
    const piece = collection.find((p) => p.id === pieceId);
    if(!piece) throw new Error(`Unknown piece "${pieceId}" in "${pieceType}"`);

    const nothingRequested = (
      opts.name === undefined && opts.author === undefined && opts.url === undefined && opts.image === undefined
      && opts.addDownloadSource.length === 0 && opts.removeDownloadSource.length === 0
      && opts.pathVariables === undefined && opts.removePathVariable.length === 0
      && opts.json === undefined
    );
    if(nothingRequested){
      throw new Error(
        "Nothing to change; pass --name/--author/--url/--image, " +
        "--add-download-source/--remove-download-source, --path-variables/--remove-path-variable, or --json"
      );
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

    if(opts.name !== undefined) piece.humanInfo.name = opts.name;
    if(opts.author !== undefined) piece.humanInfo.author = opts.author;
    if(opts.url !== undefined) piece.humanInfo.url = opts.url;
    if(opts.image !== undefined){
      if(opts.image === "-") delete piece.humanInfo.image;
      else piece.humanInfo.image = encodeImageFile(opts.image);
    }

    for(const source of opts.addDownloadSource){
      if(!piece.downloadSources.includes(source)) piece.downloadSources.push(source);
    }
    for(const source of opts.removeDownloadSource){
      const index = piece.downloadSources.indexOf(source);
      if(index === -1) throw new Error(`Download source not found on piece "${pieceId}": ${source}`);
      piece.downloadSources.splice(index, 1);
    }
    if(piece.downloadSources.length === 0){
      throw new Error("A piece must keep at least one download source");
    }

    if(opts.pathVariables !== undefined){
      Object.assign(piece.pathVariables, parseKeyValueList(opts.pathVariables));
    }
    for(const name of opts.removePathVariable){
      delete piece.pathVariables[name];
    }

    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);
    writeDraft(draftPath, draft);
    console.log(`Updated piece "${pieceId}" in "${pieceType}"`);
  }));
