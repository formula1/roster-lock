export type RoomStats = {
  roomId: string;
  matchmakerId: string;

  fullConfigHash: string;
  engineId: string;
  engineVersion: string;
  rosterHash: string;

  machineIds: Array<string>;
  machineCount: number;

  coordinatorId: string | null;

  createdAt: string;
  finishedAt: string | null;

  status: "active" | "completed" | "failed";
  failedReason: string | null;
  failedMachine: string | null;
  messageCount: number;
};

export interface IRoomStatsModel {
  create(input: {
    roomId: string,
    matchmakerId: string,
    fullConfigHash: string,
    engineId: string,
    engineVersion: string,
    rosterHash: string,
    machineIds: Array<string>,
    machineCount: number,
    coordinatorId: string | null,
  }): Promise<RoomStats>;
  getById(roomId: string): Promise<RoomStats | null>;
  listByMatchmaker(matchmakerId: string): Promise<Array<RoomStats>>;
  markCompleted(roomId: string, input: { finishedAt: string, messageCount: number }): Promise<boolean>;
  markFailed(roomId: string, input: {
    finishedAt: string, messageCount: number, failedReason: string, failedMachine: string,
  }): Promise<boolean>;
}
