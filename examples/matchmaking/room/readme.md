# Matchmaking Room

Cloudflare Workers-based matchmaking room service with admin dashboard.

## Quick Start

```bash
docker-compose up
```

- **Admin Client**: http://localhost:5173
- **API**: http://localhost:8787

Check server logs for initial admin password.

## Stack

- **API**: Cloudflare Workers + D1 + Durable Objects
- **Client**: Vite + React + React Router

## API Endpoints

### Public
- `POST /api/session` - Create anonymous session
- `GET /api/rooms` - List rooms (filter: engineName, engineVersion)
- `POST /api/rooms` - Create room
- `POST /api/rooms/join` - Join room
- `POST /api/rooms/cancel` - Cancel room (creator only)
- `POST /api/rooms/start` - Start game (creator only)
- `WS /ws/room/:roomId` - Room WebSocket

### Admin
- `POST /api/admin/login` - Admin login
- `GET /api/admin/signature` - View server public key
- `GET/PUT /api/admin/relay-server` - Relay server URL
- `GET /api/admin/rooms` - List active rooms
