import { describe, it, expect, vi, afterEach } from "vitest";
import { SIGNATURE } from "@roster-lock/utils";
import { createRelayRoom } from "../src/relay-client";
import { Env } from "../src/types";

const TEST_KEYS = await SIGNATURE.ASYMMETRIC.generateKeyPair();

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    ROOM_SESSION: {} as any,
    DB: {} as any,
    JWT_SECRET: "test-secret" as any,
    RELAY_SERVER_URL: "http://relay.example.com",
    MATCHMAKER_PUBLIC_KEY: TEST_KEYS.publicVerificationKey,
    MATCHMAKER_SECRET_KEY: TEST_KEYS.privateSigningKey,
    ...overrides,
  };
}

const ARGS = {
  rosterConfig: { engine: { name: "test" } },
  rosterConfigHash: "hash-1",
  machines: [{ machineId: "m1", publicKey: "pk1", displayName: "P1", playerCount: 1 }],
  coordinatorId: "coordinator-1",
};

describe("createRelayRoom", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws a clear error when RELAY_SERVER_URL is unconfigured", async () => {
    await expect(createRelayRoom(makeEnv({ RELAY_SERVER_URL: undefined }), ARGS))
      .rejects.toThrow(/RELAY_SERVER_URL/);
  });

  it("throws a clear error when the matchmaker keypair is unconfigured", async () => {
    await expect(createRelayRoom(makeEnv({ MATCHMAKER_SECRET_KEY: undefined }), ARGS))
      .rejects.toThrow(/MATCHMAKER_PUBLIC_KEY\/MATCHMAKER_SECRET_KEY/);
  });

  it("posts a signed request to RELAY_SERVER_URL/api/v1/room and returns the roomId", async () => {
    const fetchMock = vi.fn(async (url: string, init: any) => {
      expect(url).toBe("http://relay.example.com/api/v1/room");
      const body = JSON.parse(init.body);
      expect(body.publicKey).toBe(TEST_KEYS.publicVerificationKey);
      expect(body.coordinatorId).toBe("coordinator-1");
      expect(typeof body.signature).toBe("string");
      return new Response(JSON.stringify({ roomId: "relay-room-1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createRelayRoom(makeEnv(), ARGS);
    expect(result).toEqual({ roomId: "relay-room-1" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws when the relay server responds with a non-ok status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await expect(createRelayRoom(makeEnv(), ARGS)).rejects.toThrow(/Failed to create relay room/);
  });

  it("passes an explicit false coordinatorId straight through", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(init.body);
      expect(body.coordinatorId).toBe(false);
      return new Response(JSON.stringify({ roomId: "relay-room-1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await createRelayRoom(makeEnv(), { ...ARGS, coordinatorId: false });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
