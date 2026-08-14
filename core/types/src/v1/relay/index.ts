
// Room Creation
export type RoomConfig = {
  matchmakerId: string;
  // `false` is an explicit, deliberate "this room has no game coordinator"
  // choice (e.g. a fully-internal connection mode) - kept required rather
  // than optional so a matchmaker can't omit it by accident and have that
  // silently treated as an opt-out.
  coordinatorId: string | false;
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
