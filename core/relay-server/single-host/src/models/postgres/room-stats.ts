import { Pool } from "pg";
import { RoomStats, IRoomStatsModel } from "../types/room-stats";

function toRoomStats(row: any): RoomStats {
  return {
    roomId: row.room_id,
    matchmakerId: row.matchmaker_id,
    fullConfigHash: row.full_config_hash,
    engineId: row.engine_id,
    engineVersion: row.engine_version,
    rosterHash: row.roster_hash,
    machineIds: row.machine_ids,
    machineCount: row.machine_count,
    coordinatorId: row.coordinator_id,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    status: row.status,
    failedReason: row.failed_reason,
    failedMachine: row.failed_machine,
    messageCount: row.message_count,
  };
}

export class PostgresRoomStatsModel implements IRoomStatsModel {
  constructor(private pool: Pool) {}

  async create(input: {
    roomId: string,
    matchmakerId: string,
    fullConfigHash: string,
    engineId: string,
    engineVersion: string,
    rosterHash: string,
    machineIds: Array<string>,
    machineCount: number,
    coordinatorId: string | null,
  }): Promise<RoomStats> {
    const now = new Date().toISOString();
    const { rows } = await this.pool.query(
      `INSERT INTO room_stats
         (room_id, matchmaker_id, full_config_hash, engine_id, engine_version, roster_hash,
          machine_ids, machine_count, coordinator_id, created_at, status, message_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', 0)
       RETURNING *`,
      [
        input.roomId, input.matchmakerId, input.fullConfigHash, input.engineId, input.engineVersion,
        input.rosterHash, input.machineIds, input.machineCount, input.coordinatorId, now,
      ]
    );
    return toRoomStats(rows[0]);
  }

  async getById(roomId: string): Promise<RoomStats | null> {
    const { rows } = await this.pool.query(`SELECT * FROM room_stats WHERE room_id = $1`, [roomId]);
    return rows[0] ? toRoomStats(rows[0]) : null;
  }

  async listByMatchmaker(matchmakerId: string): Promise<Array<RoomStats>> {
    const { rows } = await this.pool.query(
      `SELECT * FROM room_stats WHERE matchmaker_id = $1 ORDER BY created_at`,
      [matchmakerId]
    );
    return rows.map(toRoomStats);
  }

  async markCompleted(roomId: string, input: { finishedAt: string, messageCount: number }): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE room_stats SET status = 'completed', finished_at = $2, message_count = $3 WHERE room_id = $1`,
      [roomId, input.finishedAt, input.messageCount]
    );
    return (rowCount ?? 0) > 0;
  }

  async markFailed(roomId: string, input: {
    finishedAt: string, messageCount: number, failedReason: string, failedMachine: string,
  }): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE room_stats
       SET status = 'failed', finished_at = $2, message_count = $3, failed_reason = $4, failed_machine = $5
       WHERE room_id = $1`,
      [roomId, input.finishedAt, input.messageCount, input.failedReason, input.failedMachine]
    );
    return (rowCount ?? 0) > 0;
  }
}
