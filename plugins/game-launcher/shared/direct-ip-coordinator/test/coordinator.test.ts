import { createServer, Server } from "node:net";
import { describe, it, expect, afterEach } from "vitest";
import { startCoordinatorServer, CoordinatorServer } from "../src/server";
import { registerAsHost, awaitHostAddress, waitForLocalPortOpen } from "../src/client";
import { getLocalNetworkAddresses } from "../src/localAddress";

const COORDINATOR_PORT = 19010;
const COORDINATOR_ADDR = { host: "127.0.0.1", port: COORDINATOR_PORT };

describe("direct-ip coordinator", () => {
  let server: CoordinatorServer | undefined;

  afterEach(() => {
    server?.stop();
    server = undefined;
  });

  it("blocks a client until the host registers, then resolves to 127.0.0.1 when the host reported no local address", async () => {
    server = startCoordinatorServer(COORDINATOR_PORT);
    server.registerRoom("room-1", 1);

    // Client connects first - this is the exact race the coordinator exists
    // to close: it must not resolve until the host registers below.
    let clientResolved = false;
    const clientPromise = awaitHostAddress(COORDINATOR_ADDR, "room-1").then((address) => {
      clientResolved = true;
      return address;
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(clientResolved).toBe(false);

    await registerAsHost(COORDINATOR_ADDR, { roomKey: "room-1", listenPort: 7500, localAddresses: [] });

    const address = await clientPromise;
    expect(address).toEqual({ ip: "127.0.0.1", port: 7500 });
  });

  it("resolves immediately for a client that connects after the host already registered", async () => {
    server = startCoordinatorServer(COORDINATOR_PORT);
    server.registerRoom("room-2", 1);

    const hostPromise = registerAsHost(COORDINATOR_ADDR, { roomKey: "room-2", listenPort: 7501, localAddresses: [] });
    // Give the host connection a moment to be processed before the client shows up.
    await new Promise((resolve) => setTimeout(resolve, 20));

    const address = await awaitHostAddress(COORDINATOR_ADDR, "room-2");
    expect(address).toEqual({ ip: "127.0.0.1", port: 7501 });
    await hostPromise;
  });

  it("serves multiple expected clients and then closes the host connection", async () => {
    server = startCoordinatorServer(COORDINATOR_PORT);
    server.registerRoom("room-3", 2);

    const hostPromise = registerAsHost(COORDINATOR_ADDR, { roomKey: "room-3", listenPort: 7502, localAddresses: [] });

    const [addressA, addressB] = await Promise.all([
      awaitHostAddress(COORDINATOR_ADDR, "room-3"),
      awaitHostAddress(COORDINATOR_ADDR, "room-3"),
    ]);
    expect(addressA).toEqual({ ip: "127.0.0.1", port: 7502 });
    expect(addressB).toEqual({ ip: "127.0.0.1", port: 7502 });

    // The host's own connection resolves once every expected client has been
    // served - the coordinator disconnects it rather than leaving it dangling.
    await hostPromise;
  });

  it("prefers the host's self-reported local address over 127.0.0.1 for a same-network client", async () => {
    server = startCoordinatorServer(COORDINATOR_PORT);
    server.registerRoom("room-4", 1);

    // registerAsHost only resolves once the coordinator has served every
    // expected client and closed this connection - so it can't be awaited
    // before the client below has had a chance to connect, or neither side
    // would ever proceed.
    const hostPromise = registerAsHost(COORDINATOR_ADDR, {
      roomKey: "room-4", listenPort: 7503, localAddresses: ["192.168.1.50"],
    });

    // This test's client and host both dial the coordinator from the same
    // process, so they share an observed remoteAddress the same way two
    // different machines behind one NAT/router would - exactly the case
    // 127.0.0.1 is wrong for, since that'd tell a real second machine to
    // connect to itself instead of to the host.
    const address = await awaitHostAddress(COORDINATOR_ADDR, "room-4");
    expect(address).toEqual({ ip: "192.168.1.50", port: 7503 });
    await hostPromise;
  });
});

describe("waitForLocalPortOpen", () => {
  const PORT = 19011;
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    server = undefined;
  });

  it("resolves once something actually starts listening on the port - not just after a delay", async () => {
    let resolved = false;
    const waitPromise = waitForLocalPortOpen(PORT, 2_000).then(() => { resolved = true; });

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(resolved).toBe(false); // nothing is listening yet - this is the race the fix closes

    server = createServer();
    await new Promise<void>((resolve) => server!.listen(PORT, "127.0.0.1", resolve));

    await waitPromise;
    expect(resolved).toBe(true);
  });

  it("rejects if nothing starts listening before the timeout", async () => {
    await expect(waitForLocalPortOpen(PORT, 300)).rejects.toThrow(/Timed out/);
  });
});

describe("getLocalNetworkAddresses", () => {
  it("returns only non-internal IPv4 addresses", () => {
    const addresses = getLocalNetworkAddresses();
    expect(Array.isArray(addresses)).toBe(true);
    for(const address of addresses){
      expect(address).not.toBe("127.0.0.1");
      expect(address).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    }
  });
});
