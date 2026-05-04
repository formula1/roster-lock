
import { PieceId } from "../shared";

type Sha256 = string;
type URLType = string;
type DownloadableSource = string;

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
    image?: URLType,
  }
  downloadSources: Array<DownloadableSource>,
  pathVariables: Record<string, string>,
  requiredPieces: Record<string, {
    expected: Array<PieceId>,
    selectable: boolean,
  }>,
};

