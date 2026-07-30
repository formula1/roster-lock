import { MessageBridge, MessageBridgeMessage } from "@roster-lock/utils";

// bindStepsToBridge (steps.ts) is written against a single MessageBridge per
// side of a connection - in production that's a WebSocket to the relay
// server. There's no need for a real socket (or a relay server) to exercise
// it: two directly-wired MessageBridge instances, each calling the other's
// handleMessage synchronously, are exactly the same shape from steps.ts's
// point of view. "agentSide" is what bindStepsToBridge is given; "roomSide"
// is the handle a test uses to play the relay's part (see room.ts).
export function wireBridgePair() {
  let agentSide!: MessageBridge;
  let roomSide!: MessageBridge;
  agentSide = new MessageBridge((message) => deliver(roomSide, message));
  roomSide = new MessageBridge((message) => deliver(agentSide, message));
  return { agentSide, roomSide };
}

function deliver(bridge: MessageBridge, message: MessageBridgeMessage) {
  // Round-trips through JSON like a real socket would, so a value that
  // can't survive serialization fails here instead of only over the wire.
  void bridge.handleMessage(JSON.parse(JSON.stringify(message)));
}
