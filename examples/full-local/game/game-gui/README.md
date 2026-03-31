# Match Lock Game - Turn-Based Battle Game

A turn-based battle game built with **React**, **React Router**, and **Tauri** that demonstrates the Match Lock matchmaking and piece selection system.

## Features

- **Multi-Page Navigation**: 6 distinct screens with React Router
- **Matchmaking**: Connect to the matchmaking service and wait for opponents
- **Character Selection**: Choose from 4 unique characters
- **Stage Selection**: Pick your battlefield
- **Download Progress**: Visual feedback for piece downloads
- **Turn-Based Combat**: Pokemon-style battle system with attacks, defense, and items
- **Integrated Loading**: Game screen includes loading state before battle starts
- **Piece Loading System**: Supports different piece types:
  - **Mandatory pieces** (📦): Life bars, UI elements (loaded before game starts)
  - **Shared pieces** (🌍): Stages (selected and shared between players)
  - **Personal pieces** (👤): Characters (each player has their own)
  - **On-demand pieces**: Moves, effects (loaded when needed)

## Architecture

### Frontend (React + TypeScript + Vite)

**Pages**:
- `StartScreen` - Welcome screen with game info
- `MatchmakingScreen` - Join queue and wait for match
- `CharacterSelectScreen` - Choose your character
- `StageSelectScreen` - Choose the battlefield
- `DownloadProgressScreen` - Download game pieces with progress bars
- `GameScreen` - Loading state + turn-based battle

**Core**:
- `App/Router.tsx` - React Router configuration
- `context/GameContext.tsx` - Global game state management
- `game-engine.ts` - Turn-based battle engine with event system
- `utils/crypto.ts` - Cryptographic utilities for signing messages

### Backend (Rust + Tauri)
- `src-tauri/src/main.rs` - Tauri application entry point
- `src-tauri/src/matchmaking.rs` - Matchmaking service client
- `src-tauri/src/relay.rs` - Relay server WebSocket client
- `src-tauri/src/webrtc.rs` - WebRTC peer connection (placeholder)

## Game Flow

1. **Start Screen** (`/`) - Initialize user credentials and display game info
2. **Matchmaking** (`/matchmaking`) - Join queue and wait for match
3. **Character Selection** (`/select-character`) - Choose your character
4. **Stage Selection** (`/select-stage`) - Choose the battlefield
5. **Download Progress** (`/download`) - Download required game pieces
6. **Battle** (`/game`) - Loading state → Turn-based combat

## State Management

The app uses React Context (`GameContext`) to manage global state that persists across navigation:

### State Flow

1. **Start Screen** → Sets `userId`, `displayName`, `userKeys`
2. **Matchmaking** → Sets `matchInfo` (room ID, relay URL)
3. **Character Select** → Sets `selectedCharacter`
4. **Stage Select** → Sets `selectedStage`
5. **Download Progress** → Reads `selectedCharacter`, `selectedStage`
6. **Game Screen** → Reads `selectedCharacter`, `selectedStage`

### State Validation

Both `DownloadProgressScreen` and `GameScreen` validate that required state exists:
- If `selectedCharacter` or `selectedStage` is missing, redirects to `/select-character`
- Console logs show state flow: `✅` for success, `❌` for errors

### Visual State Display

- **Download Progress**: Shows selected character and stage icons/names
- **Game Screen**: Displays stage name at top, character icons in battle

All state is shared across pages via the `GameProvider` wrapper in `App/index.tsx`.

## Styling

The app uses a gradient purple theme with:
- Glass-morphism effects (backdrop blur)
- Smooth transitions and animations
- Responsive grid layouts for selections
- Health bars with dynamic color gradients
- Pulse animations for loading states
- Consistent button and card styles

## Piece System

The game supports extensible pieces:

### Mandatory Pieces
- Life bars with different styles (health, super meter, ultra meter)
- UI elements
- Must be loaded before game starts

### Shared Pieces
- Stages/arenas
- Selected once and shared between all players

### Personal Pieces
- Characters
- Each player selects their own

### On-Demand Pieces
- Moves/abilities
- Weather effects
- Status effects
- Loaded when first used
- Can be required by other pieces (e.g., a move requires an effect)

## Development

### Prerequisites
- Node.js 18+
- Rust 1.70+
- Tauri CLI

### Install Dependencies
```bash
npm install
```

### Run in Development Mode
```bash
npm run tauri:dev
```

### Build for Production
```bash
npm run tauri:build
```

## Tech Stack

- **React 19** - UI framework
- **React Router 7** - Client-side routing
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tauri** - Desktop app framework
- **TweetNaCl** - Ed25519 cryptography
- **Rust** - Backend services

## Project Structure

```
src/
├── App/
│   ├── index.tsx          # Main App component
│   └── Router.tsx         # React Router setup (6 routes)
├── pages/
│   ├── StartScreen/
│   ├── MatchmakingScreen/
│   ├── CharacterSelectScreen/
│   ├── StageSelectScreen/
│   ├── DownloadProgressScreen/
│   └── GameScreen/        # Includes loading state + battle
├── context/
│   └── GameContext.tsx    # Global state management
├── utils/
│   └── crypto.ts          # Cryptographic utilities
├── styles/
│   └── global.css         # Global styles
├── game-engine.ts         # Battle engine
└── main.tsx               # Entry point
```

## Development Notes

- The app follows the same structure as `core/config-editor`
- The matchmaking service must be running on `http://localhost:3000`
- The relay server URL is provided by the matchmaking service
- WebRTC connections are currently placeholders
- Piece downloads are simulated for demonstration

## License

MIT

## Testing

To test the game, you'll need:
1. Matchmaking service running on `http://localhost:3001`
2. Relay server running
3. Two instances of the game client

## Future Enhancements

- [ ] Implement actual WebRTC peer connections
- [ ] Add real piece downloading from sources
- [ ] Implement piece verification (checksums)
- [ ] Add more complex battle mechanics
- [ ] Support for custom moves and effects
- [ ] Replay system
- [ ] Spectator mode
- [ ] Tournament brackets

## License

MIT

