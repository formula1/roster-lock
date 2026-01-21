import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { WebRTCRoom } from './WRTCRoom';

const app = express();
const PORT = process.env.PORT;
if (!PORT) throw new Error('PORT is not defined');
const RELAY_SERVER_URL = process.env.RELAY_SERVER_URL;
if (!RELAY_SERVER_URL) throw new Error('RELAY_SERVER_URL is not defined');

app.use(cors());

// Create HTTP server
const server = http.createServer();

server.on('request', (req, res)=>{
  app(req, res);
});

// Create WebSocket server for WebRTC signaling
const wss = new WebSocketServer({ server, path: '/signaling' });

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'game-server' });
});

import { router as webhookRouter } from "./webhook";
import { validateAuthFromSearch } from './auth';
import { HTTPError } from './utils/errors';
app.use("/webhooks", webhookRouter);

app.use((req, res, next)=>{
  next(new HTTPError(404, "Not found"))
})

app.use((req, res, next, error)=>{
  const { statusCode, message, body } = (()=>{
    if(error instanceof HTTPError){
      return {
        statusCode: error.statusCode,
        message: error.message,
        body: error.body
      }
    }
    if(error instanceof Error){
      return {
        statusCode: 500,
        message: error.message,
        body: void 0
      }
    }
    return {
      statusCode: 500,
      message: "Unknown Error",
      body: void 0
    }
  })()
  return res.status(statusCode).json({
    message,
    body
  })
})

// WebSocket signaling for WebRTC
wss.on('connection', async (ws: WebSocket, req) => {
  try {
    const url = new URL(req.url!, `http://localhost:${PORT}`);
    const roomId = url.searchParams.get("room");
    if(!roomId) throw new Error("Missing room Id")
    const room = WebRTCRoom.getRoom(roomId)
    if(!room) throw new Error("Nonexistant Room");
    const user = await validateAuthFromSearch(url.search, room.config, "webrtc")
    if(!user) throw new Error("Invalid User");
    room.addUser(user.publicKey, ws);
  }catch(e){
    ws.close(1000, (e as Error).message);
  }
});

server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
  console.log(`WebSocket signaling available at ws://localhost:${PORT}/signaling`);
  console.log(`Relay server URL: ${RELAY_SERVER_URL}`);
});

