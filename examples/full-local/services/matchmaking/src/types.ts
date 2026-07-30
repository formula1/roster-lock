
export interface RoomMachine {
  machineId: string;
  publicKey: string;
  displayName: string;
  playerCount: number;
}

export type CreateRoomBody = {
  rosterConfig: any;

  rosterConfigHash: string;
  machines: RoomMachine[];
  coordinatorId: string;

  publicKey: string;
  signature: string;
};
