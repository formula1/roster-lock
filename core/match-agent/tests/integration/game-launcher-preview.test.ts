import { describe, it, expect, afterEach } from "vitest";
import { previewFile, defaultPreviewFor } from "@roster-lock/game-launcher-headless";
import { startTestServer, TestServer, errorBody } from "./helpers/server";
import {
  makeEngine, makePiece, makeTempFolder, seedCompletePiece, cleanupFolder, TEST_PIECE_TYPE,
} from "./helpers/piece";
import { createFixturePluginDir } from "./helpers/plugin-dir";

const PLUGIN_NAME = "@roster-lock/game-launcher-headless";
// A fixed, test-chosen PiecePreview - not a real image format. What kind of
// asset a plugin's getPreview actually decodes (png, jpeg, a 3D model, ...)
// is that plugin's own business (see plugins/game-launcher/ikemen-go/test/
// preview.test.ts for that); this route just has to pass through whatever
// GameLauncherPlugin.getPreview/useDefaultPreview hands it, so the fixture
// used here (headless) never touches a real image codec.
const LIVE_PREVIEW = { kind: "image" as const, dataUri: "data:application/x-test;base64,bGl2ZQ==" };

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
  const piece = makePiece();

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

  it("returns the plugin's own getPreview result for a completed piece", async () => {
    const { server, folder } = await setup();
    await seedCompletePiece({
      folder, engine, pieceType: TEST_PIECE_TYPE, piece, folderName: "seen-folder",
      files: previewFile(LIVE_PREVIEW),
    });

    const res = await post(server, { engine, pieceType: TEST_PIECE_TYPE, piece });
    expect(res.status).toBe(200);
    const { preview } = await res.json();
    expect(preview).toEqual(LIVE_PREVIEW);
  });

  it("returns null when a completed piece has no preview to give", async () => {
    const { server, folder } = await setup();
    await seedCompletePiece({
      folder, engine, pieceType: TEST_PIECE_TYPE, piece, folderName: "no-preview-folder", files: {},
    });

    const res = await post(server, { engine, pieceType: TEST_PIECE_TYPE, piece });
    expect(res.status).toBe(200);
    const { preview } = await res.json();
    expect(preview).toBeNull();
  });

  it("falls back to the plugin's default preview when the piece has never been seen", async () => {
    const { server } = await setup();
    const res = await post(server, { engine, pieceType: TEST_PIECE_TYPE, piece });
    expect(res.status).toBe(200);
    const { preview } = await res.json();
    expect(preview).toEqual(defaultPreviewFor(TEST_PIECE_TYPE));
  });

  it("also falls back to the default preview when the piece exists but hasn't finished downloading", async () => {
    const { server, folder } = await setup();
    await seedCompletePiece({
      folder, engine, pieceType: TEST_PIECE_TYPE, piece, folderName: "pending-folder",
      files: previewFile(LIVE_PREVIEW), complete: false,
    });

    const res = await post(server, { engine, pieceType: TEST_PIECE_TYPE, piece });
    expect(res.status).toBe(200);
    const { preview } = await res.json();
    // Not yet downloaded means match-agent never even resolves the on-disk
    // folder getPreview would read from - the seeded preview.json above
    // (which getPreview would happily return if this ever regressed to
    // reading it) must be ignored in favor of useDefaultPreview.
    expect(preview).toEqual(defaultPreviewFor(TEST_PIECE_TYPE));
  });
});
