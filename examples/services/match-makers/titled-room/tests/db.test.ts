import { describe, it, expect } from "vitest";
import { FakeD1Database } from "./helpers/fakeD1";
import { upsertRoomIndex, deleteRoomIndex, listOpenRooms } from "../src/db";
import { RoomData } from "../src/types";

function makeRoom(overrides: Partial<RoomData> = {}): RoomData {
  return {
    id: "room-1",
    title: "Friday Night Fights",
    hostUserId: "host-1",
    gameRunnerPlugin: "@roster-lock/game-runner-ikemen-go",
    rosterConfig: { engine: { pieceDefinitions: { character: {} } } },
    gameConfig: {},
    maxPlayers: 2,
    minPlayers: 2,
    status: "waiting",
    createdAt: "2026-01-01T00:00:00.000Z",
    participants: {
      "host-1": {
        userId: "host-1", identifier: "host@example.com", machineId: "m1", playerCount: 1, ready: false,
        joinedAt: "2026-01-01T00:00:00.000Z",
      },
    },
    ...overrides,
  };
}

describe("room index (D1)", () => {
  it("upsert inserts a new room and it shows up in listOpenRooms", async () => {
    const db = new FakeD1Database() as any;
    await upsertRoomIndex(db, makeRoom());

    const rooms = await listOpenRooms(db);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({
      id: "room-1", title: "Friday Night Fights", participantCount: 1, status: "waiting",
    });
  });

  it("upsert on an existing id only updates status/participantCount", async () => {
    const db = new FakeD1Database() as any;
    await upsertRoomIndex(db, makeRoom());
    await upsertRoomIndex(db, makeRoom({
      status: "started",
      participants: {
        "host-1": {
          userId: "host-1", identifier: "host@example.com", machineId: "m1", playerCount: 1, ready: true,
          joinedAt: "2026-01-01T00:00:00.000Z",
        },
        "guest-1": {
          userId: "guest-1", identifier: "guest@example.com", machineId: "m2", playerCount: 1, ready: true,
          joinedAt: "2026-01-01T00:01:00.000Z",
        },
      },
    }));

    // status flipped to "started" - GET /room only lists "waiting" rooms.
    expect(await listOpenRooms(db)).toHaveLength(0);
  });

  it("listOpenRooms filters by title substring, case-insensitively", async () => {
    const db = new FakeD1Database() as any;
    await upsertRoomIndex(db, makeRoom({ id: "room-1", title: "Friday Night Fights" }));
    await upsertRoomIndex(db, makeRoom({ id: "room-2", title: "Saturday Showdown" }));

    const rooms = await listOpenRooms(db, "friday");
    expect(rooms.map((r) => r.id)).toEqual(["room-1"]);
  });

  it("deleteRoomIndex removes a room from the listing", async () => {
    const db = new FakeD1Database() as any;
    await upsertRoomIndex(db, makeRoom());
    await deleteRoomIndex(db, "room-1");

    expect(await listOpenRooms(db)).toHaveLength(0);
  });
});
