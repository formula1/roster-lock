import { describe, it, expect, afterEach } from "vitest";
import { copyFile } from "node:fs/promises";
import { join } from "node:path";
import { startTestServer, TestServer, errorBody } from "./helpers/server";
import {
  makeEngine, makePiece, makeTempFolder, seedCompletePiece, cleanupFolder, TEST_PIECE_TYPE,
} from "./helpers/piece";
import { createFixturePluginDir } from "./helpers/plugin-dir";

const PLUGIN_NAME = "@roster-lock/game-launcher-ikemen-go";
// Real fixture bundled with examples/mugen - same "read the real repo
// fixtures rather than fabricate a fake .sff" approach the plugin's own
// test/sff.test.ts and test/preview.test.ts use.
const KFM_DIR = join(__dirname, "../../../../examples/mugen/pieces/chars/kfm");

describe("POST /v1/game-launcher/:pluginName/preview", () => {
  const cleanups: Array<() => Promise<void> | void> = [];
  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()!();
  });

  async function setup(): Promise<{ server: TestServer, folder: string }> {
    const fixture = await createFixturePluginDir([PLUGIN_NAME]);
    cleanups.push(fixture.cleanup);
    const folder = await makeTempFolder();
    cleanups.push(() => cleanupFolder(folder));
    const server = await startTestServer(folder, undefined, fixture.pluginDir);
    cleanups.push(() => server.close());
    return { server, folder };
  }

  const engine = makeEngine();
  const piece = makePiece({ pathVariables: { defName: "kfm" } });

  function post(server: TestServer, body: unknown) {
    return fetch(`${server.httpUrl}/v1/game-launcher/${encodeURIComponent(PLUGIN_NAME)}/preview`, {
      method: "POST",
      headers: { Authorization: `Bearer ${server.authCode}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("400s on a malformed body", async () => {
    const { server } = await setup();
    const res = await post(server, {});
    expect(res.status).toBe(400);
    expect((await errorBody(res)).error).toBe("Bad Form");
  });

  it("decodes a live portrait for a completed piece", async () => {
    const { server, folder } = await setup();
    const pieceFolder = await seedCompletePiece({
      folder, engine, pieceType: TEST_PIECE_TYPE, piece, folderName: "kfm-folder", files: {},
    });
    await copyFile(join(KFM_DIR, "kfm.def"), join(pieceFolder, "kfm.def"));
    await copyFile(join(KFM_DIR, "kfm.sff"), join(pieceFolder, "kfm.sff"));

    const res = await post(server, { engine, pieceType: TEST_PIECE_TYPE, piece });
    expect(res.status).toBe(200);
    const { preview } = await res.json();
    expect(preview.kind).toBe("image");
    expect(preview.dataUri.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("falls back to the plugin's default preview when the piece has never been seen", async () => {
    const { server } = await setup();
    const res = await post(server, { engine, pieceType: TEST_PIECE_TYPE, piece });
    expect(res.status).toBe(200);
    const { preview } = await res.json();
    expect(preview.kind).toBe("image");
    expect(preview.dataUri.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("also falls back to the default preview when the piece exists but hasn't finished downloading", async () => {
    const { server, folder } = await setup();
    await seedCompletePiece({
      folder, engine, pieceType: TEST_PIECE_TYPE, piece, folderName: "pending-folder", files: {}, complete: false,
    });
    const res = await post(server, { engine, pieceType: TEST_PIECE_TYPE, piece });
    expect(res.status).toBe(200);
    const { preview } = await res.json();
    expect(preview.kind).toBe("image");
  });
});
