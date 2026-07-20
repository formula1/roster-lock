import fs from "node:fs/promises";
import path from "node:path";
import { vi } from "vitest";

import { PIECES_DIR } from "./rosterConfig";

// Game.create now always fetches piece files over HTTP via ts-client's
// getPieceFileContents - there's no more injected GetFileContents seam for
// tests to swap in a local fs read. Stubbing global fetch here keeps the
// Game class test fully offline: requests to /v1/piece/file-contents are
// served straight out of the shared example pieces/ folder, keyed off the
// pathVariables.pieceId this fixture's rosterConfig assigns each piece
// (see rosterConfig.ts) instead of a real match-agent folder lookup.
export function stubPieceFileFetch(){
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString();
    if(!url.includes("/v1/piece/file-contents")){
      throw new Error(`Unexpected fetch in test: ${url}`);
    }
    const body = JSON.parse((init?.body ?? (input instanceof Request ? await input.text() : "")) as string);
    const { pieceType, piece, filePath } = body;
    const contents = await fs.readFile(
      path.join(PIECES_DIR, pieceType, piece.pathVariables.pieceId, filePath), "utf8"
    );
    return new Response(contents, { status: 200 });
  });
}
