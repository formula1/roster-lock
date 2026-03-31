
export interface RoomConfig {
  matchmakerId: string;
  roomId: string;
  rosterConfigHash: string;
  users: RoomUser[];
}

interface RoomUser {
  userId: string;
  publicKey: string;
  displayName: string;
}
