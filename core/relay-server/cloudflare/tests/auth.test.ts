import { describe, it, expect, beforeAll } from "vitest";
import { SIGNATURE } from "@roster-lock/utils";
import {
  validateAuth, validateAuthFromSearch, searchParamsToUserMessage,
} from "../src/version-1/durable-objects/auth";
import { RoomConfig } from "../src/version-1/types";

type KeyPair = Awaited<ReturnType<typeof SIGNATURE.ASYMMETRIC.generateKeyPair>>;
type SignableFields = { roomId: string, publicKey: string, timestamp: number };

async function sign(keyPair: KeyPair, fields: SignableFields, service = "room-ws"){
  return SIGNATURE.ASYMMETRIC.createSignature(keyPair.privateSigningKey, {
    service,
    roomId: fields.roomId,
    publicKey: fields.publicKey,
    timestamp: fields.timestamp,
  });
}

describe("auth", () => {
  let keyPair: KeyPair;
  let otherKeyPair: KeyPair;
  let roomInfo: RoomConfig;

  beforeAll(async () => {
    keyPair = await SIGNATURE.ASYMMETRIC.generateKeyPair();
    otherKeyPair = await SIGNATURE.ASYMMETRIC.generateKeyPair();
    roomInfo = {
      matchmakerId: "matchmaker-1",
      coordinatorId: "coordinator-1",
      roomId: "room-1",
      rosterConfigHash: "hash-1",
      machines: [
        { machineId: "user-1", publicKey: keyPair.publicVerificationKey, displayName: "User One", playerCount: 1 },
      ],
    };
  });

  describe("validateAuth", () => {
    it("accepts a valid, freshly-signed message and returns the matching user", async () => {
      const timestamp = Date.now();
      const fields = { roomId: roomInfo.roomId, publicKey: keyPair.publicVerificationKey, timestamp };
      const signature = await sign(keyPair, fields);

      const user = await validateAuth({ ...fields, signature }, roomInfo, "room-ws");

      expect(user).toEqual({
        machineId: "user-1", publicKey: keyPair.publicVerificationKey, displayName: "User One", playerCount: 1,
      });
    });

    it("rejects a message signed for a different room", async () => {
      const timestamp = Date.now();
      const fields = { roomId: "some-other-room", publicKey: keyPair.publicVerificationKey, timestamp };
      const signature = await sign(keyPair, fields);

      const user = await validateAuth({ ...fields, signature }, roomInfo, "room-ws");

      expect(user).toBeNull();
    });

    it("rejects a timestamp too far in the future", async () => {
      const timestamp = Date.now() + 60 * 1000; // well past MAX_DRIFT (10s)
      const fields = { roomId: roomInfo.roomId, publicKey: keyPair.publicVerificationKey, timestamp };
      const signature = await sign(keyPair, fields);

      const user = await validateAuth({ ...fields, signature }, roomInfo, "room-ws");

      expect(user).toBeNull();
    });

    it("rejects a timestamp too far in the past", async () => {
      const timestamp = Date.now() - 60 * 1000; // well past MAX_MESSAGE_AGE (30s)
      const fields = { roomId: roomInfo.roomId, publicKey: keyPair.publicVerificationKey, timestamp };
      const signature = await sign(keyPair, fields);

      const user = await validateAuth({ ...fields, signature }, roomInfo, "room-ws");

      expect(user).toBeNull();
    });

    it("rejects a public key that isn't one of the room's users", async () => {
      const timestamp = Date.now();
      const fields = { roomId: roomInfo.roomId, publicKey: otherKeyPair.publicVerificationKey, timestamp };
      const signature = await sign(otherKeyPair, fields);

      const user = await validateAuth({ ...fields, signature }, roomInfo, "room-ws");

      expect(user).toBeNull();
    });

    it("rejects a message whose claimed publicKey doesn't match who actually signed it", async () => {
      const timestamp = Date.now();
      // Signed by otherKeyPair, but claiming to be the room's real user -
      // verifySignature must check the signature against the *claimed* key,
      // which won't match bytes actually produced by otherKeyPair's private key.
      const fields = { roomId: roomInfo.roomId, publicKey: keyPair.publicVerificationKey, timestamp };
      const signature = await sign(otherKeyPair, fields);

      const user = await validateAuth({ ...fields, signature }, roomInfo, "room-ws");

      expect(user).toBeNull();
    });

    it("rejects a tampered field (timestamp changed after signing)", async () => {
      const timestamp = Date.now();
      const fields = { roomId: roomInfo.roomId, publicKey: keyPair.publicVerificationKey, timestamp };
      const signature = await sign(keyPair, fields);

      // Claim a slightly different (but still in-window) timestamp than what
      // was actually signed - the signature no longer covers this message.
      const user = await validateAuth(
        { ...fields, timestamp: timestamp + 1, signature }, roomInfo, "room-ws"
      );

      expect(user).toBeNull();
    });

    it("rejects a signature that was created for a different service", async () => {
      const timestamp = Date.now();
      const fields = { roomId: roomInfo.roomId, publicKey: keyPair.publicVerificationKey, timestamp };
      // Signed for "webrtc", but this call validates against "room-ws" -
      // service name is part of the signed payload specifically so a
      // signature captured for one purpose can't be replayed for another.
      const signature = await sign(keyPair, fields, "webrtc");

      const user = await validateAuth({ ...fields, signature }, roomInfo, "room-ws");

      expect(user).toBeNull();
    });

    it("rejects a garbage signature", async () => {
      const timestamp = Date.now();
      const fields = { roomId: roomInfo.roomId, publicKey: keyPair.publicVerificationKey, timestamp };

      const user = await validateAuth({ ...fields, signature: "not-a-real-signature" }, roomInfo, "room-ws");

      expect(user).toBeNull();
    });
  });

  describe("searchParamsToUserMessage", () => {
    it("parses a fully-populated query string", () => {
      const params = new URLSearchParams({ room: "room-1", t: "12345", pk: "pk-1", sig: "sig-1" });

      expect(searchParamsToUserMessage(params)).toEqual({
        roomId: "room-1", timestamp: 12345, publicKey: "pk-1", signature: "sig-1",
      });
    });

    it.each(["room", "t", "pk", "sig"])("returns null when %s is missing", (missingKey) => {
      const all: Record<string, string> = { room: "room-1", t: "12345", pk: "pk-1", sig: "sig-1" };
      delete all[missingKey];
      const params = new URLSearchParams(all);

      expect(searchParamsToUserMessage(params)).toBeNull();
    });

    it("returns null for a non-numeric timestamp", () => {
      const params = new URLSearchParams({ room: "room-1", t: "not-a-number", pk: "pk-1", sig: "sig-1" });

      expect(searchParamsToUserMessage(params)).toBeNull();
    });
  });

  describe("validateAuthFromSearch", () => {
    it("accepts a valid, freshly-signed query string end to end", async () => {
      const timestamp = Date.now();
      const fields = { roomId: roomInfo.roomId, publicKey: keyPair.publicVerificationKey, timestamp };
      const signature = await sign(keyPair, fields);
      const params = new URLSearchParams({
        room: fields.roomId, t: String(timestamp), pk: fields.publicKey, sig: signature,
      });

      const user = await validateAuthFromSearch(params, roomInfo, "room-ws");

      expect(user).toEqual({
        machineId: "user-1", publicKey: keyPair.publicVerificationKey, displayName: "User One", playerCount: 1,
      });
    });

    it("returns null when required query params are missing", async () => {
      const params = new URLSearchParams({ room: roomInfo.roomId });

      const user = await validateAuthFromSearch(params, roomInfo, "room-ws");

      expect(user).toBeNull();
    });
  });
});
