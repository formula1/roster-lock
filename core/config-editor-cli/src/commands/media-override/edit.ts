import { Command } from "commander";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { resolveDraftPath, readDraft, writeDraft } from "../../lib/draft-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";
import { readJsonInput } from "../../lib/json-input";
import { mediaOverrideEntryOverridesSchema } from "../../lib/schemas";
import { describeSchemaShape } from "../../lib/schema-help";

function collect(value: string, previous: Array<string>){
  previous.push(value);
  return previous;
}

export const editMediaOverrideCommand = withDraftOption(new Command("edit"))
  .description(
    "Edit an existing media override's display name or download sources. Its declared `assets` can't be " +
    "changed here - since that would invalidate the content hash it's stored under, use \"media-override rescan\""
  )
  .argument("<pieceType>", "the piece type key")
  .argument("<pieceId>", "the roster piece this override applies to")
  .argument("<overrideHash>", "the override's content hash (as shown by \"media-override add\"/\"rescan\")")
  .option("--name <name>", "display name")
  .option("--add-download-source <url>", "download source url to add (repeatable)", collect, [] as Array<string>)
  .option("--remove-download-source <url>", "download source url to remove (repeatable)", collect, [] as Array<string>)
  .option(
    "--json <file>",
    "bulk-set name/downloadSources from a JSON file (or \"-\" for stdin), applied before the flags above. " +
    `Shape: ${describeSchemaShape(mediaOverrideEntryOverridesSchema)}`
  )
  .action(withErrorHandling(async (pieceType: string, pieceId: string, overrideHash: string, opts: {
    draft?: string, name?: string, addDownloadSource: Array<string>, removeDownloadSource: Array<string>, json?: string
  }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const rosterPiece = draft.stagedLock.rosters[pieceType]?.find((p) => p.id === pieceId);
    if(!rosterPiece) throw new Error(`Unknown piece "${pieceId}" in "${pieceType}"`);
    const entry = draft.stagedLock.mediaOverrides?.[pieceType]?.[rosterPiece.version.logic]?.[overrideHash];
    if(!entry) throw new Error(`Unknown media override "${overrideHash}" for "${pieceId}" in "${pieceType}"`);

    const nothingRequested = (
      opts.name === undefined && opts.addDownloadSource.length === 0
      && opts.removeDownloadSource.length === 0 && opts.json === undefined
    );
    if(nothingRequested){
      throw new Error("Nothing to change; pass --name, --add-download-source/--remove-download-source, or --json");
    }

    if(opts.json){
      const overrides = await readJsonInput(opts.json, mediaOverrideEntryOverridesSchema);
      if(overrides.name) entry.name = overrides.name;
      if(overrides.downloadSources){
        for(const source of overrides.downloadSources){
          if(!entry.downloadSources.includes(source)) entry.downloadSources.push(source);
        }
      }
    }

    if(opts.name !== undefined) entry.name = opts.name;
    for(const source of opts.addDownloadSource){
      if(!entry.downloadSources.includes(source)) entry.downloadSources.push(source);
    }
    for(const source of opts.removeDownloadSource){
      const index = entry.downloadSources.indexOf(source);
      if(index === -1) throw new Error(`Download source not found on override "${overrideHash}": ${source}`);
      entry.downloadSources.splice(index, 1);
    }
    if(entry.downloadSources.length === 0){
      throw new Error("A media override must keep at least one download source");
    }

    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);
    writeDraft(draftPath, draft);
    console.log(`Updated media override "${overrideHash}" for "${pieceId}" in "${pieceType}"`);
  }));
