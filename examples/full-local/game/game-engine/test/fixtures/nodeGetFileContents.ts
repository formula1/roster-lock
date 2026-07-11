import fs from "node:fs/promises";

import { GetFileContents } from "../../src/game/assets/loadPieceFile";

export const nodeGetFileContents: GetFileContents = (path) => fs.readFile(path, "utf8");
