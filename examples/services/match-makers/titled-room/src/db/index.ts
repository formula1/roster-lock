import type { D1Database } from "@cloudflare/workers-types";
import { createShaFromJSON } from "@roster-lock/utils";
import { RoomData } from "../types";

export type RoomIndexEntry = {
  id: string,
  title: string,
  hostUserId: string,
  gameRunnerPlugin: string,
  rosterConfigHash: string,
  status: string,
  maxPlayers: number,
  minPlayers: number,
  participantCount: number,
  createdAt: string,
};

type RoomRow = {
  id: string,
  title: string,
  host_user_id: string,
  game_runner_plugin: string,
  roster_config_hash: string,
  status: string,
  max_players: number,
  min_players: number,
  participant_count: number,
  created_at: string,
};

function rowToEntry(row: RoomRow): RoomIndexEntry {
  return {
    id: row.id,
    title: row.title,
    hostUserId: row.host_user_id,
    gameRunnerPlugin: row.game_runner_plugin,
    rosterConfigHash: row.roster_config_hash,
    status: row.status,
    maxPlayers: row.max_players,
    minPlayers: row.min_players,
    participantCount: row.participant_count,
    createdAt: row.created_at,
  };
}

function totalPlayers(room: RoomData): number {
  return Object.values(room.participants).reduce((sum, p) => sum + p.playerCount, 0);
}

// Called after every DO call that changes a room's status/roster - status
// and participant_count are the only columns that ever change after the
// initial insert, so those are all ON CONFLICT actually updates.
export async function upsertRoomIndex(db: D1Database, room: RoomData): Promise<void> {
  const rosterConfigHash = await createShaFromJSON(room.rosterConfig?.engine?.pieceDefinitions ?? null);
  await db.prepare(`
    INSERT INTO rooms (
      id, title, host_user_id, game_runner_plugin, roster_config_hash,
      status, max_players, min_players, participant_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status = excluded.status, participant_count = excluded.participant_count
  `).bind(
    room.id, room.title, room.hostUserId, room.gameRunnerPlugin, rosterConfigHash,
    room.status, room.maxPlayers, room.minPlayers, totalPlayers(room), room.createdAt,
  ).run();
}

export async function deleteRoomIndex(db: D1Database, roomId: string): Promise<void> {
  await db.prepare(`DELETE FROM rooms WHERE id = ?`).bind(roomId).run();
}

// Open rooms only - matches general-plan.md's documented browse behavior
// (sorted by create date, filterable by title, shows occupancy).
export async function listOpenRooms(db: D1Database, titleFilter?: string): Promise<Array<RoomIndexEntry>> {
  const statement = titleFilter
    ? db.prepare(`SELECT * FROM rooms WHERE status = 'waiting' AND title LIKE ? ORDER BY created_at DESC`)
        .bind(`%${titleFilter}%`)
    : db.prepare(`SELECT * FROM rooms WHERE status = 'waiting' ORDER BY created_at DESC`);
  const { results } = await statement.all<RoomRow>();
  return results.map(rowToEntry);
}
