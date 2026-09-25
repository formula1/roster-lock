import type { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RelayHarness, RelayHarnessConfig } from "./harness.js";
import {
  generateMachineDef, registerMatchmaker, createRoom, connectMachineSocket,
  waitForBridgeEvent, waitForSocketClose,
} from "./full-protocol-client.js";

// Injected rather than imported directly: every caller already has its own
// vitest devDependency running the show, and taking these as params (typed
// only, at zero runtime cost) means this package never needs vitest as a
// real dependency or risks resolving a second, disconnected instance of it.
export type ConformanceTestApi = {
  describe: typeof describe;
  it: typeof it;
  expect: typeof expect;
  beforeAll: typeof beforeAll;
  afterAll: typeof afterAll;
};

export const CONFORMANCE_CONFIG: RelayHarnessConfig = {
  jwtSecret: "conformance-test-jwt-secret-do-not-use-in-prod",
  gameCoordinatorEncryptionKey: "conformance-test-encryption-key-do-not-use-in-prod",
  initialAdmin: { username: "conformance-admin", password: "conformance-password" },
};

// Black-box checks that only assume "this thing answers the relay HTTP
// protocol on a port" - run identically against cloudflare, single-host, or
// any future implementation via a RelayHarness adapter. Complements each
// implementation's own white-box tests (which drive internals directly);
// this is what proves they actually agree with each other.
export function runRelayConformanceSuite(harness: RelayHarness, api: ConformanceTestApi) {
  const { describe, it, expect, beforeAll, afterAll } = api;

  describe("relay protocol conformance", () => {
    let baseUrl: string;

    beforeAll(async () => {
      ({ baseUrl } = await harness.start(CONFORMANCE_CONFIG));
    }, 60_000);

    afterAll(async () => {
      await harness.stop();
    });

    it("bootstraps the initial admin on first login and returns a JWT", async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(CONFORMANCE_CONFIG.initialAdmin),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { token?: unknown; passwordExpired?: unknown };
      expect(typeof body.token).toBe("string");
      expect(body.passwordExpired).toBe(true);
    });

    it("rejects a login with the wrong password", async () => {
      const res = await fetch(`${baseUrl}/api/v1/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: CONFORMANCE_CONFIG.initialAdmin.username, password: "not-it" }),
      });
      expect(res.status).toBe(401);
      expect((await res.json() as { error?: unknown }).error).toBe("Invalid credentials");
    });

    it("rejects room creation with a malformed body", async () => {
      const res = await fetch(`${baseUrl}/api/v1/room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nonsense: true }),
      });
      expect(res.status).toBe(400);
      expect((await res.json() as { error?: unknown }).error).toBe("Invalid body");
    });

    it("rejects room creation against an unregistered matchmaker", async () => {
      const res = await fetch(`${baseUrl}/api/v1/room`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rosterConfig: {},
          rosterConfigHash: "deadbeef",
          machines: [],
          coordinatorId: false,
          publicKey: "not-a-registered-key",
          signature: "not-a-real-signature",
        }),
      });
      expect(res.status).toBe(401);
      expect((await res.json() as { error?: unknown }).error).toBe("Invalid matchmaker");
    });

    it("runs the full room protocol: two machines converge on all-download", async () => {
      const loginRes = await fetch(`${baseUrl}/api/v1/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(CONFORMANCE_CONFIG.initialAdmin),
      });
      const { token: adminToken } = await loginRes.json() as { token: string };

      const matchmakerKeys = await registerMatchmaker(baseUrl, adminToken, "conformance-matchmaker");
      const machines = [
        await generateMachineDef("machine-a", "Machine A"),
        await generateMachineDef("machine-b", "Machine B"),
      ];

      const roomId = await createRoom(baseUrl, matchmakerKeys, machines);

      // Each connection wires its own honest-machine handlers before its
      // socket even opens (see connectMachineSocket) - no separate wiring
      // step here, since waiting on all of them first would race the relay,
      // which can start messaging a machine the instant *its* socket is
      // open, without waiting for our client-side Promise.all too.
      const connections = await Promise.all(
        machines.map((machine) => connectMachineSocket(baseUrl, roomId, machine)),
      );

      const allDownloads = connections.map(({ bridge }) => waitForBridgeEvent(bridge, "all-download"));
      const errors = connections.map(({ bridge }) => waitForBridgeEvent<string>(bridge, "error"));
      const closes = connections.map(({ ws }) => waitForSocketClose(ws));

      await Promise.race([
        Promise.all(allDownloads),
        Promise.race(errors).then((reason) => { throw new Error(`Room reported an error: ${reason}`); }),
      ]);

      for (const { code, reason } of await Promise.all(closes)) {
        expect(code).toBe(1000);
        expect(reason).toBe("completed");
      }
    }, 20_000);
  });
}
