
export type MediaOverrideEntry = {
  name: string,
  // subset of that pieceType's EngineAssetDefinition.name values - every named
  // asset must have classification "media"
  assets: Array<string>,
  downloadSources: Array<string>,
};
