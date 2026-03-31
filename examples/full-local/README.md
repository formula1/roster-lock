# Full Local Example - Match Lock

This example demonstrates a complete local setup of the Match Lock system with:
- **Relay Server**: Cloudflare Workers-compatible relay using Hono
- **Matchmaking Server**: Simple queue-based matchmaking (pairs 2 users)
- **Game Server**: WebRTC signaling and game coordination

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ├──────────────────────────────────┐
       │                                  │
       v                                  v
┌──────────────────┐            ┌─────────────────┐
│  Matchmaking     │            │   Game Server   │
│  Server          │            │   (WebRTC)      │
│  Port: 3001      │            │   Port: 3002    │
└────────┬─────────┘            └────────┬────────┘
         │                               │
         │         ┌─────────────────┐   │
         └────────>│  Relay Server   │<──┘
                   │  Port: 8787     │
                   └─────────────────┘
```

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Ports 8787, 3001, 3002 available

### Running the Services

```bash
# From the examples/full-local directory
docker-compose up --build
```

This will start all three services:
- Relay Server: http://localhost:8787
- Matchmaking Server: http://localhost:3001
- Game Server: http://localhost:3002

### Testing the Services

1. **Check Health**:
```bash
curl http://localhost:8787/api/v1/
curl http://localhost:3001/health
curl http://localhost:3002/health
```

2. **Join Matchmaking Queue**:
```bash
# User 1
curl -X POST http://localhost:3001/join \
  -H "Content-Type: application/json" \
  -d '{"userId": "user1"}'

# User 2 (will trigger a match)
curl -X POST http://localhost:3001/join \
  -H "Content-Type: application/json" \
  -d '{"userId": "user2"}'
```

3. **Check Queue Status**:
```bash
curl http://localhost:3001/queue
```

4. **Create Game Session**:
```bash
curl -X POST http://localhost:3002/session/create \
  -H "Content-Type: application/json" \
  -d '{"matchId": "match-123", "users": ["user1", "user2"]}'
```

5. **Connect to WebRTC Signaling**:
```bash
# Use a WebSocket client to connect to:
ws://localhost:3002/signaling?sessionId=<sessionId>&userId=<userId>
```

## Services

### Relay Server (Port 8787)
- Manages room connections using Durable Objects
- Serves the React client UI
- Handles WebSocket connections for real-time communication
- API: `/api/v1/`

### Matchmaking Server (Port 3001)
- Simple queue-based matchmaking
- Pairs users when 2 are available
- Endpoints:
  - `POST /join` - Join matchmaking queue
  - `POST /leave` - Leave matchmaking queue
  - `GET /queue` - Get queue status
  - `GET /health` - Health check

### Game Server (Port 3002)
- WebRTC signaling server
- Manages game sessions
- Coordinates peer-to-peer connections
- Endpoints:
  - `POST /session/create` - Create new game session
  - `GET /sessions` - List active sessions
  - `GET /health` - Health check
  - `WS /signaling` - WebSocket for WebRTC signaling

## Development

### Running Individual Services

```bash
# Relay Server
cd ../../core/relay-server
npm install
npm run dev

# Matchmaking Server
cd services/matchmaking
npm install
npm run dev

# Game Server
cd services/game-server
npm install
npm run dev
```

### Stopping Services

```bash
docker-compose down
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f relay-server
docker-compose logs -f matchmaking-server
docker-compose logs -f game-server
```

## Next Steps

- [ ] Create game client UI
- [ ] Implement roster lock configuration
- [ ] Add match agent integration
- [ ] Build simple game with assets
- [ ] Add pregame loading screen
- [ ] Implement WebRTC peer connections

## Notes

- This is a development setup and should not be used in production
- The relay server uses `wrangler dev` which simulates Cloudflare Workers locally
- WebRTC connections are peer-to-peer; the game server only handles signaling
- Matchmaking is very simple (first 2 users) - extend for more complex logic

