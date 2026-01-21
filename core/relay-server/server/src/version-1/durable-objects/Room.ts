import { Hono } from 'hono';
import { Env, RoomConfig } from '../types';
import { WebSocketAttachment } from './types';
import { DurableObjectState } from '@cloudflare/workers-types';

import { validateAuthFromSearch } from "./auth";

import { failWebhook } from './webhook';

import { startRoom as startBridgeRoom, handleMessage as handleBridgeMessage, isRoomFinished as isBridgeRoomFinished } from './bridge';


import { z, ZodType } from 'zod';
const newRoomCaster: ZodType<RoomConfig> = z.object({
  matchmakerId: z.string(),
  roomId: z.string(),
  rosterConfigHash: z.string(),
  users: z.array(z.object({
    userId: z.string(),
    publicKey: z.string(),
    displayName: z.string(),
  }).strict()),
}).strict();



export class Room {
  private state: DurableObjectState;
  private env: Env;
  private app: Hono;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

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

      return c.json({ status: 'created' });
    });

    // Get room info
    this.app.get('/', async (c) => {
      const isClosed = await this.state.storage.get<boolean>('isClosed');
      if(isClosed) return c.json({ error: 'Room is closed' }, 400);
      const config = await this.state.storage.get('config');
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
      const isClosed = await this.state.storage.get<boolean>('isClosed');
      if(isClosed) return c.json({ error: 'Room is closed' }, 400);
      const config = await this.state.storage.get<RoomConfig>('config');
      if(!config) return c.json([], 404);
      const url = new URL(c.req.url);
      const user = await validateAuthFromSearch(url.searchParams, config, 'room-users');
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
      const isClosed = await this.state.storage.get<boolean>('isClosed');
      if(isClosed) return c.json({ error: 'Room is closed' }, 400);
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

  async webSocketOpen(ws: WebSocket) {
    const attachment = (ws as any).deserializeAttachment() as WebSocketAttachment | null;
    if (!attachment) return;

    const config = await this.state.storage.get<RoomConfig>('config');
    if (!config) return;

    const sockets = this.state.getWebSockets();
    
    // Check if all users are now connected
    if (sockets.length === config.users.length) {
      await startBridgeRoom({ state: this.state, env: this.env });
    }
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
      await handleBridgeMessage({ state: this.state, env: this.env }, ws, message);
      if(await isBridgeRoomFinished(this.state)){
        await this.completeRoom();
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


  private async cleanupRoom(reason: string){
    const alreadyClosed = await this.state.storage.transaction(async (txn) => {
      const isClosed = await txn.get<boolean>('isClosed') || false;
      if(isClosed) return true;
      await txn.put('isClosed', true);
      return false;
    });
    if(alreadyClosed) return true;
    await this.state.storage.put('isClosed', true);
    await this.state.storage.put("closeReason", reason);
    const sockets = this.state.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.close(1000, reason);
      } catch (error) {
        console.error(`Failed to close socket:`, error);
      }
    }
    return false;
  }

  private async completeRoom() {
    const alreadyClosed = await this.cleanupRoom("completed");
    if(alreadyClosed) return;
    const config = await this.state.storage.get<any>('config');
    if (!config) return;

    const messageCount = await this.state.storage.get<number>('messageCount') || 0;

    await this.env.DB.prepare(`
      UPDATE room_stats
      SET finished_at = ?, status = ?, message_count = ?
      WHERE room_id = ?
    `).bind(
      new Date().toISOString(),
      'completed',
      messageCount,
      config.roomId
    ).run();
  }

  private async failRoom(failReason: string, failedUser: string){
    const alreadyClosed = await this.cleanupRoom("failed");
    if(alreadyClosed) return;
    const config = await this.state.storage.get<any>('config');
    if (!config) return;

    const messageCount = await this.state.storage.get<number>('messageCount') || 0;

    await this.env.DB.prepare(`
      UPDATE room_stats
      SET finished_at = ?, status = ?, message_count = ?,
          failed_reason = ?, failed_user = ?
      WHERE room_id = ?
    `).bind(
      new Date().toISOString(), 'failed', messageCount,
      failReason, failedUser,
      config.roomId
    ).run();
    await failWebhook(this.env, config, failReason, failedUser);
  }
}
