import fs from "node:fs/promises";
import { GetFileContents } from "@roster-lock/example-game-engine";

export const getFileContents: GetFileContents = (path) => fs.readFile(path, "utf8");
