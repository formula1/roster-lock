import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SIGNATURE_ASYMMETRIC } from "@roster-lock/utils";
import { RosterLockV1Config, RosterLockV1SyncDLRequestClientToAgent } from "@roster-lock/types";
import {
  RelayHarness, CONFORMANCE_CONFIG, generateMachineDef, registerMatchmaker, createRoom, MachineDef,
} from "@roster-lock/relay-conformance";
import { exchangeAndDownloadSelections } from "../../src/handle-room/version-1/room-handler-bridge/exchange-and-download-selections";
import { FakeFolderDB } from "./helpers/fakeFolderDB";
import { FakePluginManager } from "./helpers/fakePluginRuntime";
import { createSingleHostHarness } from "./helpers/relayHarness";

// A schema-valid RosterLockV1Config with zero piece types. runSelection
// (core/shared/.../validate-select) iterates config.engine.pieceDefinitions -
// empty means it resolves to an empty FinalSelection without ever calling
// runUntrustedScript, and handleDownloads then iterates that empty
// FinalSelection without ever touching fileDB. That's what lets this test
// drive match-agent's *real* relay-facing client - the actual signing,
// fetch, WebSocket, MessageBridge, encryption, and step state machine - while
// staying entirely out of match-agent's plugin/download machinery, which
// already has its own coverage (e.g. piece-ensure-ws.test.ts).
const EMPTY_LOCK_CONFIG: RosterLockV1Config = {
  configIdentity: { namespace: "roster-lock", purpose: "lock", version: 1 },
  author: "match-agent-conformance",
  title: "match-agent-conformance-empty-config",
  version: "1.0.0",
  engine: { name: "conformance-engine", version: "1.0.0", pieceDefinitions: {} },
  rosters: {},
  selection: { piece: {}, globalValidation: [], scriptDictionary: {} },
  pieceMeta: {},
};

// The room protocol has every machine decrypt every other machine's
// contribution (steps.ts's "all-decryption-for-user-final"), so both sides
// of this test must submit genuine ciphertext - @roster-lock/relay-conformance's
// wireHonestMachine deliberately returns fixed placeholder strings instead
// (it exists to prove the *relay* drives the protocol correctly without
// caring about payload contents), which the real client would then try to
// decrypt as if they were real. So this test pairs two real match-agent
// clients against each other over a real relay, rather than a real client
// against that fake one.
async function buildRoomRequest(
  baseUrl: string, roomId: string, machine: MachineDef,
): Promise<RosterLockV1SyncDLRequestClientToAgent> {
  const timestamp = Date.now();
  const signature = await SIGNATURE_ASYMMETRIC.createSignature(machine.keys.privateSigningKey, {
    service: "room-ws",
    roomId,
    publicKey: machine.keys.publicVerificationKey,
    timestamp,
  });
  return {
    relay: { url: baseUrl, roomId },
    machine: { timestamp, publicKey: machine.keys.publicVerificationKey, signature },
    rosterConfig: EMPTY_LOCK_CONFIG,
    playerSelections: { 0: {} },
  };
}

// Proves a real relay-server (single-host) and match-agent's real client
// (exchangeAndDownloadSelections/bindStepsToBridge) actually agree on the
// room protocol end to end - real signing, fetch, WebSocket, MessageBridge,
// encryption, and step state machine, driven against a real relay process.
describe("match-agent real client vs a real single-host relay", () => {
  let harness: RelayHarness;
  let baseUrl: string;

  beforeAll(async () => {
    harness = createSingleHostHarness();
    ({ baseUrl } = await harness.start(CONFORMANCE_CONFIG));
  }, 60_000);

  afterAll(async () => {
    await harness.stop();
  });

  it("two real machines converge on an empty final selection", async () => {
    const loginRes = await fetch(`${baseUrl}/api/v1/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(CONFORMANCE_CONFIG.initialAdmin),
    });
    const { token: adminToken } = await loginRes.json() as { token: string };

    const matchmakerKeys = await registerMatchmaker(baseUrl, adminToken, "match-agent-conformance");
    const machineA = await generateMachineDef("machine-a", "Machine A");
    const machineB = await generateMachineDef("machine-b", "Machine B");

    const roomId = await createRoom(baseUrl, matchmakerKeys, [machineA, machineB]);

    const [resultA, resultB] = await Promise.all([machineA, machineB].map(async (machine) => {
      const roomRequest = await buildRoomRequest(baseUrl, roomId, machine);
      return exchangeAndDownloadSelections(new FakeFolderDB(), new FakePluginManager(), roomRequest);
    }));

    expect(resultA.finalSelection).toEqual({});
    expect(resultA.downloadResults).toEqual({});
    expect(resultB.finalSelection).toEqual({});
    expect(resultB.downloadResults).toEqual({});
  }, 20_000);
});
