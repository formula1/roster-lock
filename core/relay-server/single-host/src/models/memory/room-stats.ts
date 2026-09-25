import { RoomStats, IRoomStatsModel } from "../types/room-stats";

export class InMemoryRoomStatsModel implements IRoomStatsModel {
  private byId = new Map<string, RoomStats>();

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
    const stats: RoomStats = {
      ...input,
      createdAt: new Date().toISOString(),
      finishedAt: null,
      status: "active",
      failedReason: null,
      failedMachine: null,
      messageCount: 0,
    };
    this.byId.set(stats.roomId, stats);
    return stats;
  }

  async getById(roomId: string): Promise<RoomStats | null> {
    return this.byId.get(roomId) || null;
  }

  async listByMatchmaker(matchmakerId: string): Promise<Array<RoomStats>> {
    return Array.from(this.byId.values()).filter(stats => stats.matchmakerId === matchmakerId);
  }

  async markCompleted(roomId: string, input: { finishedAt: string, messageCount: number }): Promise<boolean> {
    const stats = this.byId.get(roomId);
    if (!stats) return false;
    stats.status = "completed";
    stats.finishedAt = input.finishedAt;
    stats.messageCount = input.messageCount;
    return true;
  }

  async markFailed(roomId: string, input: {
    finishedAt: string, messageCount: number, failedReason: string, failedMachine: string,
  }): Promise<boolean> {
    const stats = this.byId.get(roomId);
    if (!stats) return false;
    stats.status = "failed";
    stats.finishedAt = input.finishedAt;
    stats.messageCount = input.messageCount;
    stats.failedReason = input.failedReason;
    stats.failedMachine = input.failedMachine;
    return true;
  }
}
