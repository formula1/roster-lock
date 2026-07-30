
// Room Creation
export type RoomConfig = {
  matchmakerId: string;
  coordinatorId: string;
  roomId: string;
  rosterConfigHash: string;
  machines: RoomMachine[];
}

export type RoomMachine = {
  machineId: string;
  publicKey: string;
  displayName: string;
  // How many local players this machine is bringing to the room, declared to
  // the matchmaker at queue time - match-agent validates each machine's
  // submitted selections against this count.
  playerCount: number;
}
