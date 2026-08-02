import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import { join as pathJoin } from "node:path";
import {
  ROSTERLOCK_V1_CASTER_JSONSCHEMA,
  ROSTERLOCK_V1_MEDIAOVERRIDEINFO_CASTER_JSONSCHEMA,
  PATH_ROSTERLOCK_MEDIA_OVERRIDE_INFO,
} from "@roster-lock/shared";
import { MediaOverrideEntry } from "@roster-lock/types";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";
import { scanMediaOverrideFolder } from "../../lib/media-override-scan";
import { readJsonInput } from "../../lib/json-input";
import { mediaOverrideEntryOverridesSchema } from "../../lib/schemas";
import { describeSchemaShape } from "../../lib/schema-help";

function collect(value: string, previous: Array<string>){
  previous.push(value);
  return previous;
}

export const addMediaOverrideCommand = withDraftOption(new Command("add"))
  .description("Scan a folder and add it as a partial media override for an existing roster piece")
  .argument("<pieceType>", "the piece type key")
  .argument("<pieceId>", "the roster piece this override applies to (as shown by \"roster list\")")
  .argument("<folder>", "path to the folder to scan for the override's asset files")
  .option(
    "--asset <name>",
    "asset name this override supplies (repeatable, must be classification \"media\")", collect, [] as Array<string>
  )
  .option("--download-source <url>", "download source url (repeatable)", collect, [] as Array<string>)
  .option("--name <name>", "display name for this override")
  .option(
    "--json <file>",
    "set name/assets/downloadSources from a JSON file (or \"-\" for stdin), applied on top of a " +
    `rosterlock.media-override-info.json in the folder if present. Shape: ${describeSchemaShape(mediaOverrideEntryOverridesSchema)}`
  )
  .action(withErrorHandling(async (pieceType: string, pieceId: string, folder: string, opts: {
    draft?: string, asset: Array<string>, downloadSource: Array<string>, name?: string, json?: string
  }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const pieceDefinition = draft.stagedLock.engine.pieceDefinitions[pieceType];
    if(!pieceDefinition) throw new Error(`Unknown piece type "${pieceType}"`);
    const rosterPiece = draft.stagedLock.rosters[pieceType]?.find((p) => p.id === pieceId);
    if(!rosterPiece) throw new Error(`Unknown piece "${pieceId}" in "${pieceType}"`);
    const logicHash = rosterPiece.version.logic;

    const entry: MediaOverrideEntry = {
      name: opts.name ?? "",
      assets: [...opts.asset],
      downloadSources: [...opts.downloadSource],
    };

    const metaPath = pathJoin(folder, PATH_ROSTERLOCK_MEDIA_OVERRIDE_INFO);
    if(existsSync(metaPath)){
      const metaJson = JSON.parse(readFileSync(metaPath, "utf-8"));
      const meta = ROSTERLOCK_V1_MEDIAOVERRIDEINFO_CASTER_JSONSCHEMA.cast(metaJson, true);
      if(!entry.name) entry.name = meta.name;
      for(const assetName of meta.assets){
        if(!entry.assets.includes(assetName)) entry.assets.push(assetName);
      }
      for(const source of meta.downloadSources){
        if(!entry.downloadSources.includes(source)) entry.downloadSources.push(source);
      }
    }

    if(opts.json){
      const overrides = await readJsonInput(opts.json, mediaOverrideEntryOverridesSchema);
      if(overrides.name) entry.name = overrides.name;
      if(overrides.assets){
        for(const assetName of overrides.assets){
          if(!entry.assets.includes(assetName)) entry.assets.push(assetName);
        }
      }
      if(overrides.downloadSources){
        for(const source of overrides.downloadSources){
          if(!entry.downloadSources.includes(source)) entry.downloadSources.push(source);
        }
      }
    }

    if(entry.assets.length === 0) throw new Error("At least one --asset is required");
    if(entry.downloadSources.length === 0){
      throw new Error(
        "At least one download source is required; pass --download-source or provide a " +
        "rosterlock.media-override-info.json with downloadSources"
      );
    }

    const { hash, errors } = await scanMediaOverrideFolder(
      folder, rosterPiece.pathVariables, pieceDefinition, entry.assets
    );
    if(errors.length > 0){
      for(const err of errors) console.error(`[${err.type}] ${err.id}: ${err.message}`);
      throw new Error("Folder does not match this override's declared assets");
    }

    draft.stagedLock.mediaOverrides ??= {};
    draft.stagedLock.mediaOverrides[pieceType] ??= {};
    draft.stagedLock.mediaOverrides[pieceType][logicHash] ??= {};
    if(draft.stagedLock.mediaOverrides[pieceType][logicHash][hash]){
      throw new Error(`Media override "${hash}" already exists for "${pieceId}"; use "media-override remove" first`);
    }
    draft.stagedLock.mediaOverrides[pieceType][logicHash][hash] = entry;
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);

    draft.draft.mediaOverrideInfo ??= {};
    draft.draft.mediaOverrideInfo[pieceType] ??= {};
    draft.draft.mediaOverrideInfo[pieceType][logicHash] ??= {};
    draft.draft.mediaOverrideInfo[pieceType][logicHash][hash] = {
      referenceFolder: folder,
      testedDownloadSources: [],
    };

    writeDraft(draftPath, draft);
    console.log(`Added media override "${hash}" for piece "${pieceId}" in "${pieceType}"`);
  }));
