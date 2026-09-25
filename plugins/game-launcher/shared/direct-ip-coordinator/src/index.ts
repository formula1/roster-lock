// A small rendezvous protocol for game launchers that connect two machines by
// raw IP (roster-lock's ConnectionConfig["type"] === "direct-tcp"): the host
// doesn't necessarily know its own reachable address upfront (NAT, or it
// hasn't bound its listen socket yet), so both sides register with a
// coordinator instead of one being handed the other's address directly. The
// host registers once it's listening; a client blocks on the coordinator
// until the host has, then learns the host's address from the reply. See
// docs/v2/ikemen-go/game-coordinator.md - written for ikemen-go, but nothing
// in this package is ikemen-specific.
//
// The coordinator also prefers routing a same-network pair over localhost/
// LAN instead of whatever address is reachable from outside it - see
// server.ts's serveClient and localAddress.ts.
//
// server.ts is the coordinator side - meant to run as its own standalone
// service (see examples/services/coordinators/direct-ip) that also answers
// relay-server's game-coordinator webhooks to learn each room's expected
// client count. client.ts is the game-launcher-plugin side that dials it.
export { startCoordinatorServer, CoordinatorServer } from "./server";
export { registerAsHost, awaitHostAddress, waitForLocalPortOpen } from "./client";
export { getLocalNetworkAddresses } from "./localAddress";
export {
  HostRegisterMessage, ClientRegisterMessage, RegisterMessage, HostAddressMessage,
} from "./protocol";
