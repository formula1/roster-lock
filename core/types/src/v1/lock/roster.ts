
import { PieceId, Sha256 } from "../shared";

type URLType = string;
type DownloadableSource = string;
// A "data:image/<type>;base64,<data>" URI, embedded directly in the lock file rather
// than fetched - unlike downloadSources, selection UIs need this available offline/at
// select-time, before any piece content has been downloaded.
type ImageDataURI = string;

export type RosterLockPiece = {
  id: PieceId,
  version: {
    logic: Sha256,
    media: Sha256,
    docs: Sha256,
  },
  humanInfo: {
    name: string,
    author: string,
    url: URLType,
    image?: ImageDataURI,
  }
  downloadSources: Array<DownloadableSource>,
  pathVariables: Record<string, string>,
  requiredPieces: Record<string, {
    expected: Array<PieceId>,
    selectable: boolean,
  }>,
};

