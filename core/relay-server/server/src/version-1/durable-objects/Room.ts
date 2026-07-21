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


import { z, ZodType } from 'zod';
const newRoomCaster: ZodType<RoomConfig> = z.object({
  matchmakerId: z.string(),
  coordinatorId: z.string(),
  roomId: z.string(),
  rosterConfigHash: z.string(),
  users: z.array(z.object({
    userId: z.string(),
    publicKey: z.string(),
    displayName: z.string(),
  }).strict()),
}).strict();

const DEFAULT_TIMEOUT_LENGTH = 5 * 1000;

export class Room {
  private state: DurableObjectState;
  private env: Env;
  private app: Hono;
  // Cloudflare always constructs a DO with exactly (state, env) - this third
  // param is only ever supplied by tests, letting them use a fast timeout
  // instead of waiting out the real 5s default.
  private timeoutLength: number;

  constructor(state: DurableObjectState, env: Env, timeoutLength: number = DEFAULT_TIMEOUT_LENGTH) {
    this.state = state;
    this.env = env;
    this.timeoutLength = timeoutLength;

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
      await this.startTimeouts(body.users);

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

    // Get users
    this.app.get('/users', async (c) => {
      const config = await this.state.storage.get<RoomConfig>('config');
      if(!config) return c.json([], 404);
      const url = new URL(c.req.url);
      const user = await validateAuthFromSearch(url.searchParams, config, 'room-ws');
      if(!user) return c.json([], 403);

      const sockets = this.state.getWebSockets();
      const attachments = sockets.map(ws => {
        const attachment = ws.deserializeAttachment() as WebSocketAttachment | null;
        return attachment;
      }).filter(Boolean);
      const userInfo: {
        userId: string;
        publicKey: string;
        displayName: string;
        connected: boolean;
        connectedAt?: string
      }[] = [];
      for(const user of config.users){
        const attachment = attachments.find(attachment => {
          if(!attachment) return false;
          return attachment.userId === user.userId;
        });
        if(!attachment){
          userInfo.push({ ...user, connected: false });
          continue;
        }
        userInfo.push({ ...user, connected: true, connectedAt: attachment.connectedAt });
      }
      return c.json(userInfo);
    });

    // WebSocket upgrade
    this.app.get('/room-ws', async (c) => {
      if (c.req.header('upgrade') !== 'websocket') {
        return c.json({ error: 'Expected WebSocket' }, 400);
      }

      const config = await this.state.storage.get<RoomConfig>('config');
      if(!config) return c.json({ error: 'Room not found' }, 404);

      const url = new URL(c.req.url);
      const user = await validateAuthFromSearch(url.searchParams, config, 'room-ws');
      if (!user) {
        return c.json({ error: 'Invalid token' }, 401);
      }
      await this.state.storage.transaction(async (txn) => {
        const connectedUsers = await txn.get<string[]>('connectedUsers') || [];
        if(connectedUsers.includes(user.userId)) throw new Error("Duplicate Connection");
        connectedUsers.push(user.userId);
        await txn.put('connectedUsers', connectedUsers);
      });

      // Create WebSocket pair - client goes to browser, server stays in DO
      const pair = new WebSocketPair() as { 0: WebSocket; 1: WebSocket };
      const client = pair[0];
      const server = pair[1];

      // Attach user metadata to the socket (survives hibernation)
      const attachment: WebSocketAttachment = {
        userId: user.userId,
        publicKey: user.publicKey,
        connectedAt: new Date().toISOString(),
      };
      (server as any).serializeAttachment(attachment);

      // Accept the WebSocket with hibernation API
      // Tags allow you to get specific sockets later via state.getWebSockets(tag)
      this.state.acceptWebSocket(server as any, [user.userId]);
      await this.refreshTimeout(user.userId);

      // There is no hibernatable "open" callback (only webSocketMessage/
      // webSocketClose/webSocketError), so check here - right as each
      // connection is accepted - whether all users are now connected.
      const sockets = this.state.getWebSockets();
      if (sockets.length === config.users.length) {
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
        await this.refreshTimeout(attachment.userId)
      }

    } catch (error) {
      console.error('WebSocket message error:', error);
      await this.failRoom((error as Error).message, attachment.userId);
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
      throw new Error("User left early");
    }catch(error){
      console.error('WebSocket close error:', error);
      await this.failRoom((error as Error).message, attachment.userId);
    }
  }

  /**
   * Called by Cloudflare when a WebSocket error occurs.
   */
  async webSocketError(ws: WebSocket, error: unknown) {
    console.error('WebSocket error:', error);
    const attachment = (ws as any).deserializeAttachment() as WebSocketAttachment | null;
    if (!attachment) return;

    console.error(`Error for user ${attachment.userId}:`, error);
    await this.failRoom((error as Error).message, attachment.userId);
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

  private async failRoom(failReason: string, failedUser: string){
    // Must happen before cleanupRoom (which closes every socket) - and is
    // best-effort/safe to call even on a race with a second failRoom, since
    // sending to an already-closed socket is caught and logged, not thrown.
    await broadcastBridgeError({ state: this.state, env: this.env }, failReason);
    const result = await this.cleanupRoom(failReason);
    if(result.alreadyClosed) return;

    await this.env.DB.prepare(`
      UPDATE room_stats
      SET finished_at = ?, status = ?, message_count = ?,
          failed_reason = ?, failed_user = ?
      WHERE room_id = ?
    `).bind(
      new Date().toISOString(), 'failed', result.messageCount,
      failReason, failedUser,
      result.config.roomId
    ).run();
    await failWebhook(this.env, result.config, failReason, failedUser);
  }

  private async startTimeouts(users: RoomConfig["users"]){
    const now = Date.now();
    const timeouts: Record<string, number> = {};
    for(const user of users){
      timeouts[user.userId] = now;
    }
    await this.state.storage.put("timeouts", timeouts)
    await this.state.storage.setAlarm(Date.now() + this.timeoutLength)
  }

  private async refreshTimeout(userId: string){
    await this.state.storage.transaction(async (txc)=>{
      const timeouts = await txc.get("timeouts") as Record<string, number>;
      const userTO = timeouts[userId];
      let isOldest = true;
      let newOldest = Number.POSITIVE_INFINITY;
      for(const [otherUser, otherTimeout] of Object.entries(timeouts)){
        if(otherUser === userId) continue;
        if(newOldest > otherTimeout){
          newOldest = otherTimeout
        }
        if(userTO > otherTimeout){
          isOldest = false;
        }
      }
      timeouts[userId] = Date.now();
      await txc.put("timeouts", timeouts)
      if(!isOldest) return;
      if(newOldest === Number.POSITIVE_INFINITY) newOldest = timeouts[userId];
      await this.state.storage.setAlarm(newOldest + this.timeoutLength)
    })
  }

  private async alarm(){
    // We are assuming the alarm only triggers if
    const userId = await this.state.storage.transaction(async (txc)=>{
      const timeouts = await txc.get("timeouts") as Record<string, number>;
      let oldestTO: null | { user: string, timeout: number } = null;
      for(const [user, timeout] of Object.entries(timeouts)){
        if(oldestTO === null){
          oldestTO = { user, timeout };
          continue;
        }
        if(oldestTO.timeout > timeout){
          oldestTO = { user, timeout };
        }
      }
      return oldestTO?.user
    })
    if(userId === void 0) return;
    return this.failRoom("User timed out", userId);
  }
}
