import { Hono } from 'hono';
import { Env, RoomConfig } from '../types';
import { WebSocketAttachment } from './types';
import { DurableObjectState } from '@cloudflare/workers-types';

import { validateAuthFromSearch } from "./auth";

import { failWebhook } from './webhook';

import {
  startRoom as startBridgeRoom, handleMessage as handleBridgeMessage,
  isRoomFinished as isBridgeRoomFinished, broadcastError as broadcastBridgeError,
  CONVO_STATE_KEY,
} from './bridge';
import { TIMEOUT_CONTROLLER, TimeoutInput } from "./TimeoutController";
import { sendPing } from './bridge/ping-pong';


import { z, ZodType } from 'zod';
const newRoomCaster: ZodType<RoomConfig> = z.object({
  matchmakerId: z.string(),
  coordinatorId: z.string(),
  roomId: z.string(),
  rosterConfigHash: z.string(),
  machines: z.array(z.object({
    machineId: z.string(),
    publicKey: z.string(),
    displayName: z.string(),
    playerCount: z.number().int().min(1),
  }).strict()),
}).strict();

const DEFAULT_TOTAL_TIMEOUT_LENGTH = 5 * 60 * 1000;
// Once a machine's WebSocket is open, ping/pong (see bridge/ping-pong.ts)
// keeps refreshing this on a ~1s cadence, so 5s is only ever a "did the last
// ping go unanswered" check, not a budget for anything slower.
const DEFAULT_USER_TIMEOUT_LENGTH = 5 * 1000;
// Covers the time between room creation (which happens the moment the
// matchmaker pairs two machines) and that machine actually opening its
// room-ws socket - unlike DEFAULT_USER_TIMEOUT_LENGTH, nothing refreshes this
// (there's no socket yet for ping/pong to use), so it has to cover real-world
// slop: network latency, piece downloads, a user lingering on a UI screen.
const DEFAULT_INITIAL_CONNECT_TIMEOUT_LENGTH = 60 * 1000;

export class Room {
  private state: DurableObjectState;
  private env: Env;
  private app: Hono;
  // Cloudflare always constructs a DO with exactly (state, env) - this third
  // param is only ever supplied by tests, letting them use fast timeouts
  // instead of waiting out the real defaults.
  private userTimeoutLength = DEFAULT_USER_TIMEOUT_LENGTH;
  private totalTimeoutLength = DEFAULT_TOTAL_TIMEOUT_LENGTH;
  private initialConnectTimeoutLength = DEFAULT_INITIAL_CONNECT_TIMEOUT_LENGTH;

  constructor(state: DurableObjectState, env: Env, timeouts?: { user: number, total: number, initialConnect: number }) {
    this.state = state;
    this.env = env;
    if(timeouts){
      this.userTimeoutLength = timeouts.user;
      this.totalTimeoutLength = timeouts.total;
      this.initialConnectTimeoutLength = timeouts.initialConnect;
    }

    // Initialize Hono router for this DO
    this.app = new Hono();

    // Initialize room
    this.app.post('/', async (c) => {
      const config = await this.state.storage.get<RoomConfig>('config');
      if(config) return c.json({ error: 'Room already exists' }, 400);

      const uncastedBody = await c.req.json();
      const casted = newRoomCaster.safeParse(uncastedBody);
      if(!casted.success){
        return c.json({ error: 'Invalid body' }, 400);
      }

      const body = casted.data;

      await this.state.storage.put('config', body);
      // Explicit placeholder state for "created, but not everyone's connected
      // yet" - startRoom only ever transitions out of this exact state, and
      // isRoomFinished treats CONVO_STATE_KEY being absent entirely as
      // "already finished and wiped" (see bridge/index.ts), so this can't be
      // left unset without those two becoming ambiguous with each other.
      await this.state.storage.put(CONVO_STATE_KEY, "wait-for-connections");
      await this.startTimeouts(body.machines);

      return c.json({ status: 'created' });
    });

    // Get room info
    this.app.get('/', async (c) => {
      // A finished room's storage is wiped entirely (see cleanupRoom) - config
      // missing means "this room doesn't exist right now", whether it was
      // never created or already cleaned up after finishing.
      const config = await this.state.storage.get<RoomConfig>('config');
      if(!config) return c.json({ error: 'Room not found' }, 404);
      const sockets = this.state.getWebSockets();
      const messageCount = await this.state.storage.get<number>('messageCount') || 0;
      return c.json({
        config,
        connections: sockets.length,
        messageCount
      });
    });

    // Get machines
    this.app.get('/machines', async (c) => {
      const config = await this.state.storage.get<RoomConfig>('config');
      if(!config) return c.json([], 404);
      const url = new URL(c.req.url);
      const machine = await validateAuthFromSearch(url.searchParams, config, 'room-ws');
      if(!machine) return c.json([], 403);

      const sockets = this.state.getWebSockets();
      const attachments = sockets.map(ws => {
        const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
        return attachment;
      }).filter(Boolean);
      const machineInfo: {
        machineId: string;
        publicKey: string;
        displayName: string;
        playerCount: number;
        connected: boolean;
        connectedAt?: string
      }[] = [];
      for(const roomMachine of config.machines){
        const attachment = attachments.find(attachment => {
          if(!attachment) return false;
          return attachment.machineId === roomMachine.machineId;
        });
        if(!attachment){
          machineInfo.push({ ...roomMachine, connected: false });
          continue;
        }
        machineInfo.push({ ...roomMachine, connected: true, connectedAt: attachment.connectedAt });
      }
      return c.json(machineInfo);
    });

    // WebSocket upgrade
    this.app.get('/room-ws', async (c) => {
      if (c.req.header('upgrade') !== 'websocket') {
        return c.json({ error: 'Expected WebSocket' }, 400);
      }

      const config = await this.state.storage.get<RoomConfig>('config');
      if(!config) return c.json({ error: 'Room not found' }, 404);

      const url = new URL(c.req.url);
      const machine = await validateAuthFromSearch(url.searchParams, config, 'room-ws');
      if (!machine) {
        return c.json({ error: 'Invalid token' }, 401);
      }
      await this.state.storage.transaction(async (txn) => {
        const connectedMachines = await txn.get<string[]>('connectedUsers') || [];
        if(connectedMachines.includes(machine.machineId)) throw new Error("Duplicate Connection");
        connectedMachines.push(machine.machineId);
        await txn.put('connectedUsers', connectedMachines);
      });

      // Create WebSocket pair - client goes to browser, server stays in DO
      const pair = new WebSocketPair() as { 0: WebSocket; 1: WebSocket };
      const client = pair[0];
      const server = pair[1];

      // Attach machine metadata to the socket (survives hibernation)
      const attachment: WebSocketAttachment = {
        machineId: machine.machineId,
        publicKey: machine.publicKey,
        connectedAt: new Date().toISOString(),
      };
      (server as any).serializeAttachment(attachment);

      // Accept the WebSocket with hibernation API
      // Tags allow you to get specific sockets later via state.getWebSockets(tag)
      this.state.acceptWebSocket(server as any, [machine.machineId]);
      await this.refreshTimeout(machine.machineId);
      await sendPing({ state: this.state, env: this.env }, machine.machineId)

      // There is no hibernatable "open" callback (only webSocketMessage/
      // webSocketClose/webSocketError), so check here - right as each
      // connection is accepted - whether all machines are now connected.
      const sockets = this.state.getWebSockets();
      if (sockets.length === config.machines.length) {
        await startBridgeRoom({ state: this.state, env: this.env });
      }

      // Return the client-side socket to be forwarded to the browser
      // The webSocket property is Cloudflare Workers specific
      return new Response(null, {
        status: 101,
        webSocket: client,
      } as ResponseInit);
    });
  }

  async fetch(request: Request): Promise<Response> {
    // Handle regular HTTP requests
    if (request.headers.get('upgrade') !== 'websocket') {
      return this.app.fetch(request, this.env);
    }

    // Handle WebSocket connection from main router

    // Reconstruct URL with /ws path for our internal router
    const url = new URL(request.url);
    const wsUrl = new URL('/room-ws', url.origin);
    wsUrl.search = url.search; // Preserve query params (token)
    
    const wsRequest = new Request(wsUrl.toString(), {
      method: request.method,
      headers: request.headers,
    });
    
    return this.app.fetch(wsRequest, this.env);
  }

  /**
   * Called by Cloudflare when a WebSocket receives a message.
   * This works even after hibernation - the DO wakes up and this is called.
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const attachment = (ws as any).deserializeAttachment() as WebSocketAttachment | null;
    if (!attachment) return console.error('WebSocket has no attachment');
    try {
      if(message instanceof ArrayBuffer) throw new Error("Invalid message");
      // finished reflects whether *this* message was the one that completed
      // the room (see bridge/index.ts's handleMessage) - re-querying convo
      // state independently here would race against the other user's own
      // in-flight webSocketMessage call and could close every socket before
      // handleDownload's own "all-download" broadcast (triggered by whichever
      // call actually finished it) has gone out.
      const finished = await handleBridgeMessage({ state: this.state, env: this.env }, ws, message);
      if(finished){
        // completeRoom deletes the alarm and closes every socket right after
        // this - refreshing the timeout first would just be a wasted write.
        await this.completeRoom();
      } else {
        await this.refreshTimeout(attachment.machineId)
      }

    } catch (error) {
      console.error('WebSocket message error:', error);
      await this.failRoom((error as Error).message, attachment.machineId);
    }
  }

  /**
   * Called by Cloudflare when a WebSocket is closed.
   * This works even after hibernation.
   */
  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    const attachment = (ws as any).deserializeAttachment() as WebSocketAttachment | null;
    if (!attachment) return;
    try {
      if(await isBridgeRoomFinished(this.state)) return;
      throw new Error("Machine left early");
    }catch(error){
      console.error('WebSocket close error:', error);
      await this.failRoom((error as Error).message, attachment.machineId);
    }
  }

  /**
   * Called by Cloudflare when a WebSocket error occurs.
   */
  async webSocketError(ws: WebSocket, error: unknown) {
    console.error('WebSocket error:', error);
    const attachment = (ws as any).deserializeAttachment() as WebSocketAttachment | null;
    if (!attachment) return;

    console.error(`Error for machine ${attachment.machineId}:`, error);
    await this.failRoom((error as Error).message, attachment.machineId);
  }


  // A finished room's storage is wiped entirely (deleteAll()) rather than
  // just flagged with an "isClosed" marker, so we're not paying to store a
  // dead room's data forever. That means "config" itself - read and deleted
  // in the same transaction - is now the only available compare-and-swap
  // signal for "has someone already claimed this room's cleanup": whoever's
  // transaction actually sees and deletes it is the sole winner, and every
  // other (including later, on an already-wiped room) caller sees it already
  // gone. Whatever the winner needs afterward (config, messageCount) has to
  // be read out *inside* that same claiming transaction, since a plain
  // storage.get() call after this returns would otherwise race deleteAll().
  private async cleanupRoom(
    reason: string
  ): Promise<{ alreadyClosed: true } | { alreadyClosed: false, config: RoomConfig, messageCount: number }> {
    const claim = await this.state.storage.transaction(async (txn) => {
      const config = await txn.get<RoomConfig>('config');
      if(!config) return null;
      const messageCount = await txn.get<number>('messageCount') || 0;
      await txn.delete('config');
      return { config, messageCount };
    });
    if(!claim) return { alreadyClosed: true };

    // WebSocket close frames are hard-capped at 125 bytes total (2-byte
    // status code + reason); an untruncated reason here can produce a
    // close frame the wire protocol rejects as malformed.
    const closeReason = new TextEncoder().encode(reason).length > 123
      ? new TextDecoder().decode(new TextEncoder().encode(reason).slice(0, 123))
      : reason;
    const sockets = this.state.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.close(1000, closeReason);
      } catch (error) {
        console.error(`Failed to close socket:`, error);
      }
    }

    await this.state.storage.deleteAll();
    // deleteAll() clears stored data, not necessarily a pending alarm - call
    // this explicitly rather than assume that's implied.
    await this.state.storage.deleteAlarm();

    return { alreadyClosed: false, config: claim.config, messageCount: claim.messageCount };
  }

  private async completeRoom() {
    const result = await this.cleanupRoom("completed");
    if(result.alreadyClosed) return;

    await this.env.DB.prepare(`
      UPDATE room_stats
      SET finished_at = ?, status = ?, message_count = ?
      WHERE room_id = ?
    `).bind(
      new Date().toISOString(),
      'completed',
      result.messageCount,
      result.config.roomId
    ).run();
  }

  private async failRoom(failReason: string, failedMachine: string){
    // Must happen before cleanupRoom (which closes every socket) - and is
    // best-effort/safe to call even on a race with a second failRoom, since
    // sending to an already-closed socket is caught and logged, not thrown.
    await broadcastBridgeError({ state: this.state, env: this.env }, failReason);
    const result = await this.cleanupRoom(failReason);
    if(result.alreadyClosed) return;

    await this.env.DB.prepare(`
      UPDATE room_stats
      SET finished_at = ?, status = ?, message_count = ?,
          failed_reason = ?, failed_machine = ?
      WHERE room_id = ?
    `).bind(
      new Date().toISOString(), 'failed', result.messageCount,
      failReason, failedMachine,
      result.config.roomId
    ).run();
    await failWebhook(this.env, result.config, failReason, failedMachine);
  }

  private async startTimeouts(machines: RoomConfig["machines"]){
    return this.state.storage.transaction(async (txc)=>{
      const timeouts: Array<TimeoutInput> = []
      timeouts.push({
        id: "total-timeout",
        offset: this.totalTimeoutLength,
        fn: { id: "total-timeout", args: {} }
      })
      for(const machine of machines){
        timeouts.push({
          id: "machine-timeout-" + machine.machineId,
          offset: this.initialConnectTimeoutLength,
          fn: { id: "machine-timeout", args: { machineId: machine.machineId } }
        })
      }
      await TIMEOUT_CONTROLLER.addTimeouts(txc, timeouts);
    })
  }

  private async refreshTimeout(machineId: string){
    await this.state.storage.transaction(async (txc)=>{
      await TIMEOUT_CONTROLLER.cancelTimeout(txc, "machine-timeout-" + machineId)
      await TIMEOUT_CONTROLLER.addTimeouts(txc, [
        {
          id: "machine-timeout-" + machineId,
          offset: this.userTimeoutLength,
          fn: { id: "machine-timeout", args: { machineId: machineId } }
        }
      ]);
    })
  }

  private async alarm(){
    const fns =  await this.state.storage.transaction(async (txc)=>{
      return TIMEOUT_CONTROLLER.handleTimeout(txc);
    });
    for(const fn of fns){
      if(fn.id === "machine-timeout"){
        return this.failRoom("Machine timed out", fn.args.machineId);
      }
      if(fn.id === "total-timeout"){
        return this.failRoom("Total timed out", "");
      }
      if(fn.id === "ping"){
        await sendPing({ state: this.state, env: this.env }, fn.args.machineId);
      }
    }
  }
}
