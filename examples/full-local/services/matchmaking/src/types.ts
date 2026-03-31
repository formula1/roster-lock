
export interface RoomUser {
  userId: string;
  publicKey: string;
  displayName: string;
}

export type CreateRoomBody = {
  rosterConfig: any;

  rosterConfigHash: string;
  users: RoomUser[];
  webhooks: {
    onRoomComplete: string;
    onRoomFailed?: string;
  };

  publicKey: string;
  signature: string;
};
