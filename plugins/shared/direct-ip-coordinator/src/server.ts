import { createServer, Socket } from "node:net";
import { encodeMessage, splitLines, RegisterMessage, HostAddressMessage } from "./protocol";

type RoomState = {
  // How many clients this room expects - set ahead of time via registerRoom
  // (the coordinator *service*'s webhook handler calls this once relay-server
  // notifies it a room's machines are known, before either side's game-runner
  // plugin has connected). Defaults to 0 so a room nobody registered just
  // never finishes rather than misbehaving.
  expectedClients: number,
  hostSocket?: Socket,
  hostRemoteIp?: string,
  hostListenPort?: number,
  // The host's own self-reported non-internal addresses (see
  // localAddress.ts) - preferred over hostRemoteIp for a same-network
  // client (see serveClient) since hostRemoteIp is whatever the host looks
  // like from *this coordinator's* vantage point, which for anyone behind
  // NAT is a shared gateway address, not something a peer on the same LAN
  // can actually dial.
  hostLocalAddresses: Array<string>,
  waitingClients: Array<Socket>,
  servedClients: number,
};

export type CoordinatorServer = {
  // Tells the coordinator how many clients to expect for a room before any
  // of them connect - see docs/v2/ikemen-go/game-coordinator.md.
  registerRoom(roomKey: string, expectedClients: number): void,
  clearRoom(roomKey: string): void,
  stop(): void,
};

export function startCoordinatorServer(port: number): CoordinatorServer {
  const rooms = new Map<string, RoomState>();

  function ensureRoom(roomKey: string): RoomState {
    let room = rooms.get(roomKey);
    if (!room) {
      room = { expectedClients: 0, hostLocalAddresses: [], waitingClients: [], servedClients: 0 };
      rooms.set(roomKey, room);
    }
    return room;
  }

  // Comparing the two TCP connections' own observed remote addresses (never
  // anything either side self-reports) tells us the client shares the
  // host's gateway - true both for "literally the same machine" and "a
  // different machine behind the same NAT/router", which is exactly the
  // "local network" case a client should prefer over routing out to
  // hostRemoteIp and back in. Either way, a self-reported local address (see
  // hostLocalAddresses) is dialable directly - loopback for the same-machine
  // case, the host's real LAN address otherwise - so it's preferred first;
  // "127.0.0.1" only remains the fallback for a host that reported none
  // (e.g. no non-internal interface at all).
  function serveClient(room: RoomState, socket: Socket) {
    if (room.hostRemoteIp === undefined || room.hostListenPort === undefined) return;
    const sameNetwork = socket.remoteAddress === room.hostRemoteIp;
    const localAddress = sameNetwork ? room.hostLocalAddresses[0] : undefined;
    const message: HostAddressMessage = {
      ip: localAddress ?? (sameNetwork ? "127.0.0.1" : room.hostRemoteIp),
      port: room.hostListenPort,
    };
    socket.end(encodeMessage(message));
    room.servedClients += 1;
  }

  function maybeFinishRoom(roomKey: string, room: RoomState) {
    if (room.expectedClients > 0 && room.servedClients >= room.expectedClients) {
      room.hostSocket?.end();
      rooms.delete(roomKey);
    }
  }

  function handleMessage(socket: Socket, message: RegisterMessage) {
    const room = ensureRoom(message.roomKey);

    if (message.role === "host") {
      room.hostSocket = socket;
      room.hostRemoteIp = socket.remoteAddress;
      room.hostListenPort = message.listenPort;
      room.hostLocalAddresses = message.localAddresses;
      // Clients that connected before the host did were parked here,
      // waiting exactly for this - this is what actually fixes the
      // connect-before-host-is-ready race, not just documents it.
      for (const waitingClient of room.waitingClients.splice(0)) {
        serveClient(room, waitingClient);
      }
      maybeFinishRoom(message.roomKey, room);
      return;
    }

    if (room.hostRemoteIp !== undefined) {
      serveClient(room, socket);
      maybeFinishRoom(message.roomKey, room);
    } else {
      room.waitingClients.push(socket);
    }
  }

  const server = createServer((socket) => {
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const { lines, remainder } = splitLines(buffer);
      buffer = remainder;
      for (const line of lines) {
        try {
          handleMessage(socket, JSON.parse(line) as RegisterMessage);
        } catch {
          socket.destroy();
          return;
        }
      }
    });
    // No handler needed beyond swallowing the event - an abrupt disconnect
    // (host or client giving up) just leaves this socket's room state as-is;
    // the room is cleaned up once expectedClients is actually served, or
    // never if it isn't (matching the "race condition for now" scope - no
    // timeout/retry handling here yet).
    socket.on("error", () => {});
  });

  server.listen(port);

  return {
    registerRoom(roomKey, expectedClients) {
      ensureRoom(roomKey).expectedClients = expectedClients;
    },
    clearRoom(roomKey) {
      const room = rooms.get(roomKey);
      room?.hostSocket?.end();
      for (const waitingClient of room?.waitingClients ?? []) waitingClient.end();
      rooms.delete(roomKey);
    },
    stop() {
      server.close();
    },
  };
}
