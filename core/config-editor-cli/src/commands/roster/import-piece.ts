import { Command } from "commander";
import { resolve } from "node:path";
import { ROSTERLOCK_V1_CASTER_JSONSCHEMA } from "@roster-lock/shared";
import { cloneJSON } from "@roster-lock/utils";
import { RosterLockPiece, RosterLockV1Config } from "@roster-lock/types";
import { resolveDraftPath, readDraft, writeDraft, DRAFT_SUFFIX } from "../../lib/draft-io";
import { readLock } from "../../lib/lock-io";
import { withDraftOption } from "../../lib/cli-options";
import { withErrorHandling } from "../../lib/errors";

function readSourceConfig(sourcePath: string): RosterLockV1Config {
  const resolved = resolve(process.cwd(), sourcePath);
  if(resolved.endsWith(DRAFT_SUFFIX)) return readDraft(resolved).stagedLock;
  return readLock(resolved);
}

function findByMatchingVersion(collection: Array<RosterLockPiece> | undefined, version: RosterLockPiece["version"]){
  return collection?.find((p) => p.version.logic === version.logic && p.version.media === version.media);
}

// Pulls in whatever the piece needs so its requiredPieces.expected ids resolve in the target doc: reuse an
// existing piece of matching logic/media version if one's already there (fixing up the expected id to match it),
// otherwise copy the source piece over verbatim under its original id.
function importRequiredPieces(
  sourceConfig: RosterLockV1Config, targetConfig: RosterLockV1Config, piece: RosterLockPiece, importing: Set<string>
){
  for(const [requiredType, requirement] of Object.entries(piece.requiredPieces)){
    requirement.expected = requirement.expected.map(
      (requiredId) => importRequiredPiece(sourceConfig, targetConfig, requiredType, requiredId, importing)
    );
  }
}

function importRequiredPiece(
  sourceConfig: RosterLockV1Config, targetConfig: RosterLockV1Config,
  pieceType: string, sourceId: string, importing: Set<string>
): string {
  const sourcePiece = sourceConfig.rosters[pieceType]?.find((p) => p.id === sourceId);
  if(!sourcePiece) throw new Error(`Required piece "${sourceId}" of type "${pieceType}" not found in the source document`);

  const collection = targetConfig.rosters[pieceType] ?? (targetConfig.rosters[pieceType] = []);
  const existing = findByMatchingVersion(collection, sourcePiece.version);
  if(existing) return existing.id;

  const importKey = `${pieceType}:${sourceId}`;
  if(importing.has(importKey)){
    throw new Error(`Circular required-piece reference detected at "${pieceType}" piece "${sourceId}"`);
  }
  if(collection.find((p) => p.id === sourceId)){
    throw new Error(
      `Cannot import required piece "${sourceId}" (${pieceType}): a different piece already exists under that id ` +
      "in the target draft"
    );
  }

  const requiredPiece = cloneJSON(sourcePiece);
  collection.push(requiredPiece);

  importing.add(importKey);
  importRequiredPieces(sourceConfig, targetConfig, requiredPiece, importing);
  importing.delete(importKey);

  console.log(
    `Imported required piece "${requiredPiece.id}" into "${pieceType}": ` +
    `logic ${requiredPiece.version.logic}, media ${requiredPiece.version.media}`
  );
  return requiredPiece.id;
}

export const importPieceCommand = withDraftOption(new Command("import-piece"))
  .description(
    "Copy a piece from another draft or published lock file into this draft's rosters, trusting the source's " +
    "existing hash as-is - use \"roster add-piece\" instead if you need the hash (re)computed from local files"
  )
  .argument("<sourcePath>", `path to the source draft (*${DRAFT_SUFFIX}) or published lock file`)
  .argument("<pieceType>", "the piece type key (must exist in this draft's engine)")
  .argument("<pieceId>", "the piece's id in the source (as shown by \"roster list\" run against the source)")
  .option("--as <newId>", "import under a different piece id (defaults to the source piece's id)")
  .action(withErrorHandling(async (sourcePath: string, pieceType: string, pieceId: string, opts: {
    draft?: string, as?: string
  }) => {
    const draftPath = resolveDraftPath(opts.draft);
    const draft = readDraft(draftPath);

    const pieceDefinition = draft.stagedLock.engine.pieceDefinitions[pieceType];
    if(!pieceDefinition) throw new Error(`Unknown piece type "${pieceType}"; define it first with "engine add-piece-type"`);

    const sourceConfig = readSourceConfig(sourcePath);
    const sourceCollection = sourceConfig.rosters[pieceType];
    const sourcePiece = sourceCollection?.find((p) => p.id === pieceId);
    if(!sourcePiece) throw new Error(`Unknown piece "${pieceId}" in "${pieceType}" in "${sourcePath}"`);

    const newId = opts.as ?? sourcePiece.id;
    const collection = draft.stagedLock.rosters[pieceType] ?? (draft.stagedLock.rosters[pieceType] = []);
    if(collection.find((p) => p.id === newId)){
      throw new Error(
        `Piece "${newId}" already exists in "${pieceType}"; use --as to import under a different id, ` +
        `or "roster remove-piece" first`
      );
    }

    const piece: RosterLockPiece = { ...cloneJSON(sourcePiece), id: newId };
    collection.push(piece);
    importRequiredPieces(sourceConfig, draft.stagedLock, piece, new Set([`${pieceType}:${sourcePiece.id}`]));
    ROSTERLOCK_V1_CASTER_JSONSCHEMA.cast(draft.stagedLock);

    writeDraft(draftPath, draft);
    console.log(
      `Imported piece "${newId}"${newId !== sourcePiece.id ? ` (from "${sourcePiece.id}")` : ""} into "${pieceType}": ` +
      `logic ${piece.version.logic}, media ${piece.version.media}`
    );
  }));
