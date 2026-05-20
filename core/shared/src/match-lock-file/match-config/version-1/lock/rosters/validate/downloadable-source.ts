

export function validateDownloadableSourceList(sources: Array<string>){
  if(sources.length === 0)
    throw new Error("Expecting at least 1 source");
  if(new Set(sources).size !== sources.length)
    throw new Error("Has duplicate sources");
}

