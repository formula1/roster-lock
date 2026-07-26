import {
  PATH_ROSTERLOCK_PIECE_INFO,
  ROSTERLOCK_V1_PIECEINFO_CASTER_JSONSCHEMA,
  calculatePieceVersion,
  getAssetsOfFiles
} from "@roster-lock/shared";
import { bufferToStr } from "@roster-lock/utils";
import { collectStream, collectWalkEntries, entriesFileLoader } from "../../../../../../utils/walk";
import { PieceDefinition, PieceValue } from "../../types";
import { PieceSource } from "../source";

export type ProgressListener = (progress: { file: string, total: number, current: number })=>any

export async function createPieceValue(
  {
    source, pathVariables, filesWithAssets, pieceDefinition, progressListener }: {
    source: PieceSource,
    pathVariables: Record<string, string>,
    filesWithAssets: Awaited<ReturnType<typeof getAssetsOfFiles>>["filesWithAssets"],
    pieceDefinition: PieceDefinition,
    progressListener?: ProgressListener
  }
){
  const piece: PieceValue = {
    id: "",
    version: {
      logic: "",
      media: "",
      docs: "",
    },
    humanInfo: {
      name: "",
      author: "",
      url: "",
    },
    downloadSources: [],
    pathVariables,
    requiredPieces: {},
  };

  const entries = await collectWalkEntries(source.entries);

  const [version, humanInfo] = await Promise.all([
    Promise.resolve().then(async ()=>{
      piece.version = await calculatePieceVersion(
        filesWithAssets,
        entriesFileLoader(entries),
        progressListener
      )
      return piece.version;
    }),
    Promise.resolve().then(async ()=>{
      try {
        const infoEntry = entries.get(PATH_ROSTERLOCK_PIECE_INFO);
        if(!infoEntry) return;
        const json = JSON.parse(bufferToStr(await collectStream(infoEntry.loadFile())));
        const metaData = ROSTERLOCK_V1_PIECEINFO_CASTER_JSONSCHEMA.cast(json, true);
        piece.downloadSources = metaData.downloadSources;
        piece.humanInfo = metaData.humanInfo;
        return metaData.humanInfo;
      }catch(e){
        console.log("Failed To Load Human Info", e);
      }
    }),
    Promise.resolve().then(async ()=>{
      for(const requiredPieceType of pieceDefinition.requires){
        piece.requiredPieces[requiredPieceType] = {
          selectable: false,
          expected: [],
        };
      }
    })
  ])

  if(humanInfo) piece.id = `@${slugify(humanInfo.author)}/${slugify(humanInfo.name)}`;
  else piece.id = `#${version.logic}/${version.media}`;

  return piece;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Replace whitespace and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove non-alphanumeric except hyphens
    .replace(/[^a-z0-9-]+/g, '')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
    // Collapse multiple hyphens
    .replace(/-+/g, '-');
}
