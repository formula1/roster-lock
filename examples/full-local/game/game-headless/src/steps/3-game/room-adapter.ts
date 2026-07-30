import { Room } from "@roster-lock/example-game-engine";
import { createSimpleEmitter } from "@roster-lock/utils";
import { PeerRoom } from "./datachannel-room";

// PeerRoom only carries a single opaque "body" per message (WebRTC/relay transport
// doesn't know about game-engine's actionType concept), so the game Room's
// (actionType, body) pair is wrapped into that single body on the wire.
type GameRoomMessage = { actionType: string, body: any };

export function toGameRoom(peerRoom: PeerRoom): Room {
  const onAction = createSimpleEmitter<[userId: string, actionType: string, body: any]>();
  peerRoom.onAction((userId, message: GameRoomMessage) => {
    onAction.emit(userId, message.actionType, message.body);
  });

  return {
    userIds: peerRoom.users,
    onAction,
    broadcastAction(actionType, body){
      peerRoom.broadcastAction({ actionType, body } satisfies GameRoomMessage);
    },
  };
}
