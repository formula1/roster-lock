import http from "node:http";
import { startCoordinatorServer } from "@roster-lock/direct-ip-coordinator";
import { createApp } from "./http-router";

const HTTP_PORT = process.env.PORT;
if(!HTTP_PORT) throw new Error("PORT is not defined");

const TCP_PORT = process.env.COORDINATOR_TCP_PORT;
if(!TCP_PORT) throw new Error("COORDINATOR_TCP_PORT is not defined");

// The rendezvous TCP server a direct-tcp game-runner plugin actually dials
// (see @roster-lock/direct-ip-coordinator's server.ts) - this service's own
// job is just wrapping it with the HTTP webhook surface relay-server expects
// from any registered Game Coordinator. Nothing here is game-specific: any
// game-runner plugin using roster-lock's direct-tcp connection mode can
// register this same coordinator and dial the same TCP protocol.
const coordinatorServer = startCoordinatorServer(Number(TCP_PORT));

const app = createApp(coordinatorServer);
const server = http.createServer(app);

server.listen(Number(HTTP_PORT), () => {
  console.log(`direct-ip-coordinator HTTP running on port ${HTTP_PORT}`);
  console.log(`direct-ip-coordinator TCP rendezvous running on port ${TCP_PORT}`);
  console.log("Success Webhook:", "/webhook/room-complete");
  console.log("Failure Webhook:", "/webhook/room-failure");
});
