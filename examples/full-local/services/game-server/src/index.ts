import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { WebRTCRoom } from './WRTCRoom';

const PORT = process.env.PORT;
if (!PORT) throw new Error('PORT is not defined');

const server = http.createServer();
import { app } from "./http-router";
server.on('request', (req, res)=>{
  app(req, res);
});

import { handleWebSocket } from "./ws-router";
// Create WebSocket server for WebRTC signaling
const wss = new WebSocketServer({ server, path: '/signaling' });

// WebSocket signaling for WebRTC
wss.on('connection', async (ws: WebSocket, req) => {
  handleWebSocket(ws, req);
});

server.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
  console.log(`WebSocket signaling available at ws://localhost:${PORT}/signaling`);
  console.log("Success Webhook:", `/webhook/room-complete`)
  console.log("Failure Webhook:", `/webhook/room-failure`)
});

