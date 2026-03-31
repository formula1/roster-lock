# Development Guide

## Getting Started

### Prerequisites

1. **Node.js** (v18 or higher)
2. **Rust** (v1.70 or higher)
3. **Tauri CLI**

### Installation

```bash
# Install dependencies
npm install

# Install Tauri CLI globally (optional)
npm install -g @tauri-apps/cli
```

### Running the Development Server

```bash
# Start the Tauri development server
npm run tauri:dev
```

This will:
1. Start Vite dev server on `http://localhost:1420`
2. Compile the Rust backend
3. Launch the Tauri application window

### Building for Production

```bash
# Build the application
npm run tauri:build
```

The built application will be in `src-tauri/target/release/`.

## Project Structure

```
examples/full-local/game/
├── src/                      # Frontend TypeScript code
│   ├── main.ts              # Main entry point
│   ├── ui.ts                # UI manager
│   ├── game-client.ts       # Game client
│   ├── game-engine.ts       # Turn-based battle engine
│   ├── piece-loader.ts      # Piece loading system
│   └── crypto.ts            # Cryptographic utilities
├── src-tauri/               # Rust backend
│   ├── src/
│   │   ├── main.rs          # Tauri entry point
│   │   ├── matchmaking.rs   # Matchmaking client
│   │   ├── relay.rs         # Relay server client
│   │   └── webrtc.rs        # WebRTC (placeholder)
│   ├── Cargo.toml           # Rust dependencies
│   └── tauri.conf.json      # Tauri configuration
├── example-pieces/          # Example piece implementations
│   ├── character/
│   ├── move/
│   ├── effect/
│   └── lifebar/
├── index.html               # HTML template
├── vite.config.ts           # Vite configuration
└── package.json             # Node dependencies
```

## Development Workflow

### 1. Testing Locally

To test the full matchmaking flow, you need:

1. **Matchmaking Service** (from `examples/full-local/services/matchmaking`)
   ```bash
   cd examples/full-local/services/matchmaking
   npm run dev
   ```

2. **Relay Server** (from `core/relay-server`)
   ```bash
   cd core/relay-server
   npm run dev
   ```

3. **Two Game Clients**
   ```bash
   # Terminal 1
   cd examples/full-local/game
   npm run tauri:dev
   
   # Terminal 2
   cd examples/full-local/game
   npm run tauri:dev
   ```

### 2. Testing Without Matchmaking

For quick testing of the game engine without matchmaking:

1. Comment out the matchmaking flow in `src/main.ts`
2. Directly call `ui.showScreen('battle')` and `gameClient.startBattle()`

### 3. Hot Reload

The Vite dev server supports hot module replacement (HMR):
- Changes to TypeScript files will reload automatically
- Changes to Rust files require recompiling (automatic with `tauri:dev`)

## Adding New Features

### Adding a New Character

1. Create character folder: `example-pieces/character/water/`
2. Add `stats.json`:
   ```json
   {
     "name": "Aqua",
     "element": "water",
     "baseStats": { "hp": 100, "attack": 20, "defense": 25, "speed": 15, "special": 25 },
     "moves": ["water-gun", "bubble-beam"]
   }
   ```
3. Add `index.js` with character logic
4. Update `sample-roster-config.json` to include the new character

### Adding a New Move

1. Create move folder: `example-pieces/move/water-gun/`
2. Add `index.js` with move logic:
   ```javascript
   export const moveData = {
     id: 'water-gun',
     name: 'Water Gun',
     type: 'water',
     power: 1.0,
     accuracy: 1.0
   };
   
   export function execute(attacker, defender, gameState) {
     // Move logic here
   }
   ```
3. Reference the move in character's `requiredPieces`

### Adding a New Effect

1. Create effect folder: `example-pieces/effect/freeze/`
2. Add `index.js` with effect logic
3. Reference the effect in move's `requiredPieces`

## Debugging

### Frontend Debugging

1. Open DevTools in the Tauri window: `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)
2. Use `console.log()` for debugging
3. Check the Network tab for API calls

### Backend Debugging

1. Add `println!()` statements in Rust code
2. Check the terminal running `tauri:dev` for output
3. Use `RUST_LOG=debug npm run tauri:dev` for verbose logging

### Common Issues

**Issue**: "Failed to join queue"
- **Solution**: Make sure matchmaking service is running on `http://localhost:3001`

**Issue**: "Not connected to relay"
- **Solution**: Make sure relay server is running and accessible

**Issue**: Rust compilation errors
- **Solution**: Run `cargo clean` in `src-tauri/` and try again

## Testing

### Manual Testing Checklist

- [ ] Join matchmaking queue
- [ ] Match found notification
- [ ] Character selection screen appears
- [ ] Select character
- [ ] Battle screen loads
- [ ] Health bars display correctly
- [ ] Attack action works
- [ ] Defend action works
- [ ] Special move works
- [ ] Item usage works
- [ ] Turn switching works
- [ ] Game over detection works

### Future: Automated Tests

- Unit tests for game engine logic
- Integration tests for matchmaking flow
- E2E tests with Playwright/Tauri

## Performance Optimization

### Frontend
- Use `requestAnimationFrame` for animations
- Debounce frequent updates
- Lazy load pieces on-demand

### Backend
- Use async/await for all I/O operations
- Pool WebSocket connections
- Cache loaded pieces

## Contributing

When adding new features:
1. Follow the existing code style
2. Add comments for complex logic
3. Update documentation
4. Test thoroughly before committing

## Resources

- [Tauri Documentation](https://tauri.app/v1/guides/)
- [Vite Documentation](https://vitejs.dev/)
- [TweetNaCl Documentation](https://github.com/dchest/tweetnacl-js)

