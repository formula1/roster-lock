import { WebSocket } from "ws";
import { MessageBridge } from "@roster-lock/utils";
import { RoomConfig, RoomMachine } from "@roster-lock/types";
import { RoomTimeouts } from "../timeouts";
import { runRoomSteps, RoomUser, errorMessage } from "../steps";
import { successWebhook, failWebhook } from "../webhook";
import { IRoomStatsModel } from "../../models";
import { IMessageQueue } from "../../message-queue";

// Once a machine's WebSocket is open, the ping/pong loop in steps.ts keeps
// noticing a dead connection on its own - this is only the "did the last
// ping go unanswered" style budget CF used, kept here for the initial
// connect window where there's no socket yet for a ping to ride on.
const DEFAULT_TOTAL_TIMEOUT_LENGTH = 5 * 60 * 1000;
const DEFAULT_INITIAL_CONNECT_TIMEOUT_LENGTH = 60 * 1000;

// How long this server's claim on being a room's controller survives
// without renewal, and how often it renews - renewal has to land comfortably
// inside the TTL so a slow tick (GC pause, event-loop backlog) doesn't let
// the claim lapse and get stolen out from under a room that's still running.
const CONTROLLER_CLAIM_TTL_MS = 10_000;
const CONTROLLER_CLAIM_RENEW_INTERVAL_MS = 3_000;

function roomInputChannel(roomId: string) { return `room-input-${roomId}`; }
function roomOutputChannel(roomId: string) { return `room-output-${roomId}`; }
function machineSendChannel(machineId: string, roomId: string) { return `machine-send-${machineId}-${roomId}`; }
function machineReceiveChannel(machineId: string, roomId: string) { return `machine-receive-${machineId}-${roomId}`; }
function machineCloseChannel(machineId: string, roomId: string) { return `machine-close-${machineId}-${roomId}`; }

type Connection = {
  machineId: string;
  publicKey: string;
  connectedAt: string;
  ws: WebSocket;
  unsubscribe: () => void;
};

type RoomStatus = "wait-for-connections" | "running" | "completed" | "failed";

type RuntimeConnection = {
  machineId: string;
  publicKey: string;
  connectedAt: string;
  serverId: string;
  bridge: MessageBridge;
  unsubscribe: null | (() => void);
};

type LocalRoomRuntime = {
  config: RoomConfig;
  status: RoomStatus;
  timeouts: RoomTimeouts;
  messageCount: number;
  roomBridge: MessageBridge;
  connections: Map<string, RuntimeConnection>;
  unsubscribe: () => void;
};

type MachineInfo = RoomMachine & { connected: boolean, connectedAt?: string };

// A relay deployment can run as several servers behind a load balancer, so
// a room's controller (the one running runRoomSteps) and the server
// actually holding a given machine's WebSocket can be different processes.
// This class plays both roles at once for every room/connection it touches,
// talking to the other role - even when it's itself - only through the
// message queue, so there's a single code path regardless of where the
// controller actually lives:
//  - Controller side (this.localRooms): owns a room's config/status/steps.
//    Reachable only via `room-input-<roomId>` / `room-output-<roomId>`.
//  - Connection side (this.localUsers): owns a machine's real WebSocket.
//    Reachable only via `machine-send-*` (bridge -> ws) and
//    `machine-close-*` (controller says "close this socket now"); it
//    forwards raw ws traffic in via `machine-receive-*`.
export class RoomManager_MessageQueue {
  localRooms = new Map<string, LocalRoomRuntime>();
  localUsers = new Map<string, Connection>();

  constructor(
    public roomStats: IRoomStatsModel,
    public mq: IMessageQueue,
    public serverId: string
  ) {}

  async create(config: RoomConfig): Promise<RoomConfig> {
    const claimed = await this.mq.claim(config.roomId, this.serverId, CONTROLLER_CLAIM_TTL_MS);
    if (!claimed) throw new Error("Room already exists");
    const roomBridge = new MessageBridge((message) => {
      this.mq.publish(roomOutputChannel(config.roomId), message);
    });
    const unsubscribe = await this.mq.subscribe(roomInputChannel(config.roomId), (message) => {
      roomBridge.handleMessage(message);
    });
    const runtime: LocalRoomRuntime = {
      config,
      status: "wait-for-connections",
      timeouts: new RoomTimeouts(),
      messageCount: 0,
      roomBridge,
      connections: new Map(),
      unsubscribe,
    };
    this.localRooms.set(config.roomId, runtime);
    this.scheduleControllerClaimRenewal(config.roomId, runtime);

    runtime.timeouts.set("total-timeout", DEFAULT_TOTAL_TIMEOUT_LENGTH, () => {
      this.failRoom(config.roomId, "Total timed out", "");
    });
    for (const machine of config.machines) {
      runtime.timeouts.set(`machine-timeout-${machine.machineId}`, DEFAULT_INITIAL_CONNECT_TIMEOUT_LENGTH, () => {
        this.failRoom(config.roomId, "Machine timed out", machine.machineId);
      });
    }

    runtime.roomBridge.onRequest("config", () => {
      if (!this.localRooms.has(config.roomId)) return null;
      return runtime.config;
    });

    runtime.roomBridge.onRequest("machines", () => {
      if (!this.localRooms.has(config.roomId)) return null;
      return runtime.config.machines.map((machine) => {
        const connection = runtime.connections.get(machine.machineId);
        return { ...machine, connected: !!connection, connectedAt: connection?.connectedAt };
      });
    });

    runtime.roomBridge.onRequest("addMachine", async ({ machine, serverId }: { machine: RoomMachine, serverId: string }) => {
      if (!this.localRooms.has(config.roomId)) return false;
      if (runtime.status !== "wait-for-connections") return false;
      if (runtime.connections.has(machine.machineId)) return false;
      runtime.timeouts.clear(`machine-timeout-${machine.machineId}`);
      const bridge = new MessageBridge((message) => {
        this.mq.publish(machineSendChannel(machine.machineId, config.roomId), message);
      });
      const connection: RuntimeConnection = {
        machineId: machine.machineId,
        publicKey: machine.publicKey,
        connectedAt: new Date().toISOString(),
        serverId,
        bridge,
        unsubscribe: null,
      };
      runtime.connections.set(machine.machineId, connection);
      connection.unsubscribe = await this.mq.subscribe(
        machineReceiveChannel(machine.machineId, config.roomId), (message) => {
          bridge.handleMessage(message);
        }
      );
      return { expecting: config.machines.length, have: runtime.connections.size };
    });

    runtime.roomBridge.onEvent("startRoom", () => {
      this.startRoom(config.roomId, runtime);
    });

    runtime.roomBridge.onEvent("failRoom", ({ reason, machineId }) => {
      this.failRoom(config.roomId, reason, machineId);
    });

    return runtime.config;
  }

  // Renews this server's controller claim on `roomId` on a cadence well
  // inside CONTROLLER_CLAIM_TTL_MS, for as long as the room is still
  // tracked locally. Reuses RoomTimeouts purely as a scheduler here (not for
  // its own failure semantics), so this timer gets swept up for free by the
  // `timeouts.clearAll()` every teardown path already does.
  private scheduleControllerClaimRenewal(roomId: string, runtime: LocalRoomRuntime) {
    runtime.timeouts.set("controller-claim-renew", CONTROLLER_CLAIM_RENEW_INTERVAL_MS, async () => {
      if (!this.localRooms.has(roomId)) return;
      const stillOwned = await this.mq.claim(roomId, this.serverId, CONTROLLER_CLAIM_TTL_MS);
      if (!this.localRooms.has(roomId)) return;
      if (!stillOwned) {
        this.failRoom(roomId, "Lost controller claim", "");
        return;
      }
      this.scheduleControllerClaimRenewal(roomId, runtime);
    });
  }

  async getConfig(roomId: string): Promise<RoomConfig | null> {
    return await this.tempReq(roomId, "config", {}) as RoomConfig | null;
  }

  async getMachines(roomId: string): Promise<Array<MachineInfo> | null> {
    return await this.tempReq(
      roomId, "machines", {}
    ) as Array<RoomMachine & { connected: boolean, connectedAt?: string }>;
  }

  // Called once a machine's WebSocket is upgraded and authenticated against
  // this room's config. Returns false for a duplicate connection or a room
  // that isn't (still) accepting connections - the caller should close the
  // socket in that case.
  async connectMachine(roomId: string, machine: RoomMachine, ws: WebSocket): Promise<boolean> {
    const addedMachine = await this.tempReq(
      roomId, "addMachine", { machine, serverId: this.serverId }
    ) as false | { expecting: number, have: number };
    if (!addedMachine) return false;

    const unsubscribeSend = await this.mq.subscribe(
      machineSendChannel(machine.machineId, roomId), (message) => {
        ws.send(JSON.stringify(message));
      }
    );
    const unsubscribeClose = await this.mq.subscribe(
      machineCloseChannel(machine.machineId, roomId), (payload) => {
        const { code, reason } = payload as { code: number, reason: string };
        ws.close(code, reason);
      }
    );
    const unsubscribe = () => {
      unsubscribeSend();
      unsubscribeClose();
    };

    ws.on("message", (raw) => {
      this.mq.publish(
        machineReceiveChannel(machine.machineId, roomId),
        JSON.parse(raw.toString())
      );
    });

    const connection: Connection = {
      machineId: machine.machineId,
      publicKey: machine.publicKey,
      connectedAt: new Date().toISOString(),
      ws,
      unsubscribe,
    };
    this.localUsers.set(machine.machineId, connection);

    ws.on("close", () => {
      this.localUsers.delete(machine.machineId);
      connection.unsubscribe();
      this.tempEvent(roomId, "failRoom", {
        reason: "Machine left early", machineId: machine.machineId
      });
    });
    ws.on("error", (error) => {
      this.localUsers.delete(machine.machineId);
      connection.unsubscribe();
      this.tempEvent(roomId, "failRoom", {
        reason: errorMessage(error), machineId: machine.machineId
      });
    });

    if (addedMachine.expecting === addedMachine.have) {
      this.tempEvent(roomId, "startRoom", {});
    }

    return true;
  }

  private startRoom(roomId: string, runtime: LocalRoomRuntime) {
    runtime.status = "running";

    const users: Array<RoomUser> = Array.from(runtime.connections.values()).map((connection) => ({
      bridge: connection.bridge,
      publicKey: connection.publicKey,
    }));

    runRoomSteps(users).then(
      () => this.completeRoom(roomId),
      (error) => this.failRoom(roomId, errorMessage(error), ""),
    );
  }

  private async completeRoom(roomId: string) {
    const runtime = this.localRooms.get(roomId);
    if (!runtime || runtime.status === "completed" || runtime.status === "failed") return;
    runtime.status = "completed";
    runtime.timeouts.clearAll();
    this.closeAllSockets(roomId, runtime, 1000, "completed");
    runtime.unsubscribe();
    this.localRooms.delete(roomId);
    await this.mq.release(roomId, this.serverId);

    await this.roomStats.markCompleted(roomId, {
      finishedAt: new Date().toISOString(),
      messageCount: runtime.messageCount,
    });
    try {
      await successWebhook(runtime.config);
    } catch (e) {
      console.error("success webhook failed", roomId, e);
    }
  }

  private async failRoom(roomId: string, reason: string, failedMachine: string) {
    const runtime = this.localRooms.get(roomId);
    if (!runtime || runtime.status === "completed" || runtime.status === "failed") return;
    runtime.status = "failed";
    runtime.timeouts.clearAll();

    // Best-effort: tell every connected machine why, then close - a peer may
    // already be gone, in which case sendEvent throws and is swallowed here
    // rather than stopping the rest from being told.
    for (const connection of runtime.connections.values()) {
      try {
        connection.bridge.sendEvent("error", reason);
      } catch (e) {
        console.error("Failed to send error event to a socket", roomId, e);
      }
    }
    this.closeAllSockets(roomId, runtime, 1000, reason);
    runtime.unsubscribe();
    this.localRooms.delete(roomId);
    await this.mq.release(roomId, this.serverId);

    await this.roomStats.markFailed(roomId, {
      finishedAt: new Date().toISOString(),
      messageCount: runtime.messageCount,
      failedReason: reason,
      failedMachine,
    });
    try {
      await failWebhook(runtime.config, reason, failedMachine);
    } catch (e) {
      console.error("failure webhook failed", roomId, e);
    }
  }

  // The controller doesn't hold any machine's real WebSocket - whichever
  // server does might be a different process entirely - so "close it" has
  // to travel through the queue too, on a channel of its own rather than
  // machine-send-* (that one only carries opaque bridge protocol messages
  // meant to be forwarded verbatim to the remote peer, not interpreted by
  // the connection-holding server itself).
  private closeAllSockets(roomId: string, runtime: LocalRoomRuntime, code: number, reason: string) {
    // WebSocket close frames are hard-capped at 125 bytes total (2-byte
    // status code + reason) - an untruncated reason can produce a close
    // frame the wire protocol rejects as malformed.
    const closeReason = Buffer.byteLength(reason) > 123
      ? Buffer.from(reason).subarray(0, 123).toString()
      : reason;
    for (const connection of runtime.connections.values()) {
      try {
        connection.bridge.destroy();
        connection.unsubscribe?.();
        void this.mq.publish(machineCloseChannel(connection.machineId, roomId), { code, reason: closeReason });
      } catch (error) {
        console.error("Failed to close socket:", error);
      }
    }
  }

  // Calls a controller-side onRequest handler for `roomId` regardless of
  // whether the controller is this process or another one - always through
  // the queue, via a throwaway bridge that only lives for this one call.
  // Concurrent calls each get their own bridge/subscription on the same
  // room-output channel; MessageBridge only resolves the pending request
  // whose id matches, so unrelated responses in flight are ignored rather
  // than cross-wired.
  private async tempReq(roomId: string, key: string, data: any) {
    const tmpBridge = new MessageBridge((message) => {
      this.mq.publish(roomInputChannel(roomId), message);
    });

    const unsubscribe = await this.mq.subscribe(roomOutputChannel(roomId), async (message) => {
      try {
        await tmpBridge.handleMessage(message);
      } catch { /* not a response this bridge is waiting on */ }
    });
    try {
      return await tmpBridge.sendRequest(key, data);
    } finally {
      unsubscribe();
    }
  }

  private tempEvent(roomId: string, key: string, data: any) {
    const tmpBridge = new MessageBridge((message) => {
      this.mq.publish(roomInputChannel(roomId), message);
    });
    tmpBridge.sendEvent(key, data);
  }
}
