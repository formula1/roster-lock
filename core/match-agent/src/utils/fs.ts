import { readdir, stat as getStat } from "fs/promises";
import { join as pathJoin, sep as pathSep, extname } from "path";
import { lookup as mimeLookup } from "mime-types";

// getAssetsOfFiles matches file paths against each asset's glob (e.g.
// "media/particles.json"), which is relative to the piece folder root -
// so these must be yielded relative, not absolute.
export async function* getFilesFromFolder(rootPath: string, relative: string = "./"): AsyncIterable<string> {
  for(const file of await readdir(pathJoin(rootPath, relative))){
    const stat = await getStat(pathJoin(rootPath, relative, file));
    if(stat.isDirectory()){
      yield* getFilesFromFolder(rootPath, pathJoin(relative, file))
    } else {
      yield pathJoin(relative, file).split(pathSep).join("/");
    }
  }
}

// Only extensions in this set get a real mimetype - mime-types resolves
// its full table (mime-db) against ANY extension, including ones that
// collide with engine-specific formats (.ts -> video/mp2t, .air -> Adobe
// AIR installer), so gate lookups to formats we actually intend to serve
// as their web mimetype. Everything else (.cns, .def, .sff, unknown) is
// application/octet-stream - the engine reads it as raw bytes regardless.
const WEB_SAFE_EXTENSIONS = new Set([
  // images
  "png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "svg",
  // audio
  "mp3", "wav", "ogg", "oga", "m4a", "flac", "aac",
  // video
  "mp4", "webm", "ogv",
  // fonts
  "woff", "woff2", "ttf", "otf",
  // text/data
  "json", "txt", "csv", "xml", "html", "css",
]);

export function mimeTypeFor(filePath: string): string {
  const ext = extname(filePath).slice(1).toLowerCase();
  if(!WEB_SAFE_EXTENSIONS.has(ext)) return "application/octet-stream";
  return mimeLookup(filePath) || "application/octet-stream";
}

