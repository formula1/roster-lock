import { WebSocket } from "ws";
import { MessageBridge } from "@roster-lock/utils";
import { RoomConfig, RoomMachine } from "@roster-lock/types";
import { RoomTimeouts } from "../timeouts";
import { runRoomSteps, RoomUser, errorMessage } from "../steps";
import { successWebhook, failWebhook } from "../webhook";
import { IRoomStatsModel } from "../../models";

// Once a machine's WebSocket is open, the ping/pong loop in steps.ts keeps
// noticing a dead connection on its own - this is only the "did the last
// ping go unanswered" style budget CF used, kept here for the initial
// connect window where there's no socket yet for a ping to ride on.
const DEFAULT_TOTAL_TIMEOUT_LENGTH = 5 * 60 * 1000;
const DEFAULT_INITIAL_CONNECT_TIMEOUT_LENGTH = 60 * 1000;

type Connection = {
  machineId: string;
  publicKey: string;
  connectedAt: string;
  ws: WebSocket;
  bridge: MessageBridge;
};

type RoomStatus = "wait-for-connections" | "running" | "completed" | "failed";

type RoomRuntime = {
  config: RoomConfig;
  status: RoomStatus;
  connections: Map<string, Connection>; // keyed by machineId
  timeouts: RoomTimeouts;
  messageCount: number;
};

type MachineInfo = RoomMachine & { connected: boolean, connectedAt?: string };

export class RoomManager_SingleProcess {
  private rooms = new Map<string, RoomRuntime>();

  constructor(private roomStats: IRoomStatsModel){

  }

  create(config: RoomConfig): RoomConfig {
    if (this.rooms.has(config.roomId)) throw new Error("Room already exists");
    const runtime: RoomRuntime = {
      config,
      status: "wait-for-connections",
      connections: new Map(),
      timeouts: new RoomTimeouts(),
      messageCount: 0,
    };
    this.rooms.set(config.roomId, runtime);

    runtime.timeouts.set("total-timeout", DEFAULT_TOTAL_TIMEOUT_LENGTH, () => {
      this.failRoom(config.roomId, "Total timed out", "");
    });
    for (const machine of config.machines) {
      runtime.timeouts.set(`machine-timeout-${machine.machineId}`, DEFAULT_INITIAL_CONNECT_TIMEOUT_LENGTH, () => {
        this.failRoom(config.roomId, "Machine timed out", machine.machineId);
      });
    }

    return runtime.config;
  }

  getConfig(roomId: string): RoomConfig | null {
    return this.rooms.get(roomId)?.config || null;
  }

  getMachines(roomId: string): Array<MachineInfo> | null {
    const runtime = this.rooms.get(roomId);
    if (!runtime) return null;
    return runtime.config.machines.map((machine) => {
      const connection = runtime.connections.get(machine.machineId);
      return { ...machine, connected: !!connection, connectedAt: connection?.connectedAt };
    });
  }

  // Called once a machine's WebSocket is upgraded and authenticated against
  // this room's config. Returns false for a duplicate connection or a room
  // that isn't (still) accepting connections - the caller should close the
  // socket in that case.
  connectMachine(roomId: string, machine: RoomMachine, ws: WebSocket): boolean {
    const runtime = this.rooms.get(roomId);
    if (!runtime) return false;
    if (runtime.status !== "wait-for-connections") return false;
    if (runtime.connections.has(machine.machineId)) return false;

    const bridge = new MessageBridge((message) => ws.send(JSON.stringify(message)));
    ws.on("message", (raw) => {
      runtime.messageCount++;
      bridge.handleMessage(JSON.parse(raw.toString()));
    });

    const connection: Connection = {
      machineId: machine.machineId,
      publicKey: machine.publicKey,
      connectedAt: new Date().toISOString(),
      ws,
      bridge,
    };
    runtime.connections.set(machine.machineId, connection);
    runtime.timeouts.clear(`machine-timeout-${machine.machineId}`);

    ws.on("close", () => {
      bridge.destroy();
      if (runtime.status === "completed" || runtime.status === "failed") return;
      this.failRoom(roomId, "Machine left early", machine.machineId);
    });
    ws.on("error", (error) => {
      if (runtime.status === "completed" || runtime.status === "failed") return;
      this.failRoom(roomId, errorMessage(error), machine.machineId);
    });

    if (runtime.connections.size === runtime.config.machines.length) {
      this.startRoom(roomId, runtime);
    }

    return true;
  }

  private startRoom(roomId: string, runtime: RoomRuntime) {
    runtime.status = "running";

    const users: Array<RoomUser> = Array.from(runtime.connections.values()).map((connection) => ({
      bridge: connection.bridge,
      publicKey: connection.publicKey,
    }));

    runRoomSteps(users).then(
      () => this.completeRoom(roomId, runtime),
      (error) => this.failRoom(roomId, errorMessage(error), ""),
    );
  }

  private async completeRoom(roomId: string, runtime: RoomRuntime) {
    if (runtime.status === "completed" || runtime.status === "failed") return;
    runtime.status = "completed";
    runtime.timeouts.clearAll();
    this.closeAllSockets(runtime, 1000, "completed");
    this.rooms.delete(roomId);

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
    const runtime = this.rooms.get(roomId);
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
    this.closeAllSockets(runtime, 1000, reason);
    this.rooms.delete(roomId);

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

  private closeAllSockets(runtime: RoomRuntime, code: number, reason: string) {
    // WebSocket close frames are hard-capped at 125 bytes total (2-byte
    // status code + reason) - an untruncated reason can produce a close
    // frame the wire protocol rejects as malformed.
    const closeReason = Buffer.byteLength(reason) > 123
      ? Buffer.from(reason).subarray(0, 123).toString()
      : reason;
    for (const connection of runtime.connections.values()) {
      try {
        connection.bridge.destroy();
        connection.ws.close(code, closeReason);
      } catch (error) {
        console.error("Failed to close socket:", error);
      }
    }
  }
}
