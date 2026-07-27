import { describe, it, expect } from "vitest";
import { bindStepsToBridge } from "../../src/handle-room/version-1/room-handler-bridge/steps";
import { wireBridgePair } from "./helpers/bridge";
import { driveRoomProtocol } from "./helpers/room";
import { FakeFolderDB } from "./helpers/fakeFolderDB";
import { makeLockConfig, makeHeroSelection } from "./helpers/lockConfig";

// These exercise the two "scary" parts of the sync-dl protocol - real
// runSelection (roster/requirement validation + personal merge) and real
// handleDownloads (recursive required-piece resolution + dedup) - without
// a relay server, WebSocket, or network download. bindStepsToBridge only
// needs a MessageBridge; wireBridgePair connects two of them directly, and
// driveRoomProtocol plays the relay's side of the protocol in-process
// (mirroring room-handler-bridge/server.pseudo.ts).
describe("bindStepsToBridge: runSelection + handleDownloads", () => {
  it("runs the full protocol for two users picking the same piece, dedupes the shared nested requirement, and both agents converge on the same result", async () => {
    const lockConfig = makeLockConfig();
    const machines = [{ publicKey: "pk-a", playerCount: 1 }, { publicKey: "pk-b", playerCount: 1 }];

    const pairA = wireBridgePair();
    const pairB = wireBridgePair();

    const dbA = new FakeFolderDB();
    const dbB = new FakeFolderDB();

    const resultAPromise = bindStepsToBridge({
      bridge: pairA.agentSide,
      fileDB: dbA,
      machines,
      ownMachinePublicKey: "pk-a",
      ownSelections: { 0: makeHeroSelection() },
      lockConfig,
      scriptsByPath: {},
      gameControlledSelections: {},
    } as any);
    const resultBPromise = bindStepsToBridge({
      bridge: pairB.agentSide,
      fileDB: dbB,
      machines,
      ownMachinePublicKey: "pk-b",
      ownSelections: { 0: makeHeroSelection() },
      lockConfig,
      scriptsByPath: {},
      gameControlledSelections: {},
    } as any);

    await driveRoomProtocol([
      { bridge: pairA.roomSide, publicKey: "pk-a" },
      { bridge: pairB.roomSide, publicKey: "pk-b" },
    ]);

    const [resultA, resultB] = await Promise.all([resultAPromise, resultBPromise]);

    // runSelection: both agents decrypted the same inputs independently and
    // must agree on the merged personal selection.
    expect(resultA.finalSelection).toEqual(resultB.finalSelection);
    expect(resultA.finalSelection.character).toEqual({
      type: "personal",
      value: {
        "pk-a:0": makeHeroSelection().character,
        "pk-b:0": makeHeroSelection().character,
      },
    });

    // handleDownloads: both users chose the same piece (which itself
    // requires the same nested weapon) - each agent must dedupe that down
    // to a single download call per piece, not one per reference.
    for (const db of [dbA, dbB]) {
      expect(db.calls).toEqual([
        { pieceType: "character", pieceId: "hero-1" },
        { pieceType: "weapon", pieceId: "sword-1" },
      ]);
    }

    expect(resultA.downloadResults).toEqual({
      character: { "hero-1": { pieceType: "character", pieceId: "hero-1", pieceVersions: { logic: "1.0.0", media: "1.0.0" }, folder: "/fake/character/hero-1" } },
      weapon: { "sword-1": { pieceType: "weapon", pieceId: "sword-1", pieceVersions: { logic: "1.0.0", media: "1.0.0" }, folder: "/fake/weapon/sword-1" } },
    });
  });

  it("rejects when a user selects a piece missing from the roster (runSelection validation)", async () => {
    const lockConfig = makeLockConfig();
    const machines = [{ publicKey: "pk-a", playerCount: 1 }, { publicKey: "pk-b", playerCount: 1 }];

    const pairA = wireBridgePair();
    const pairB = wireBridgePair();

    const badSelection = { character: [{ id: "not-a-real-piece", required: { weapon: { mandatory: [], selectable: [] } } }] };

    const resultAPromise = bindStepsToBridge({
      bridge: pairA.agentSide,
      fileDB: new FakeFolderDB(),
      machines,
      ownMachinePublicKey: "pk-a",
      ownSelections: { 0: badSelection },
      lockConfig,
      scriptsByPath: {},
      gameControlledSelections: {},
    } as any);
    const resultBPromise = bindStepsToBridge({
      bridge: pairB.agentSide,
      fileDB: new FakeFolderDB(),
      machines,
      ownMachinePublicKey: "pk-b",
      ownSelections: { 0: makeHeroSelection() },
      lockConfig,
      scriptsByPath: {},
      gameControlledSelections: {},
    } as any);
    // both agents run runSelection independently over the same decrypted
    // inputs, so the bad selection fails validation on both sides.
    resultAPromise.catch(() => {});
    resultBPromise.catch(() => {});

    await driveRoomProtocol([
      { bridge: pairA.roomSide, publicKey: "pk-a" },
      { bridge: pairB.roomSide, publicKey: "pk-b" },
    ]).catch(() => {});

    // bindStepsToBridge rejects with whatever value the room's "error" event
    // carried (steps.ts: bridge.onEvent("error", (error) => reject(error))) -
    // a plain string here, not an Error instance.
    await expect(resultAPromise).rejects.toBe("Piece not-a-real-piece is not in the roster");
    await expect(resultBPromise).rejects.toBe("Piece not-a-real-piece is not in the roster");
  });
});
