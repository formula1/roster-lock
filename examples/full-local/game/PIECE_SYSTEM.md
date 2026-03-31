# Piece System Documentation

## Overview

The Match Lock game uses an extensible piece system that allows different types of game content to be loaded dynamically. This enables modding, custom content, and flexible game design.

## Piece Types

### 1. Mandatory Pieces
**Selection Strategy**: `mandatory`

Pieces that MUST be loaded before the game starts. These are essential for the game to function.

**Examples**:
- Life bars / Health displays
- UI elements
- Core game mechanics
- Different meter types (super meter, ultra meter, one-time use abilities)

**Loading**: Loaded during game preparation, before player selection.

**Use Case**: An engine may support different UI styles, but rosters may expect a specific one. For example, a fighting game roster might require a specific life bar style that shows both health and super meter.

### 2. Shared Pieces
**Selection Strategy**: `shared`

Pieces that are selected once and shared between all players in the match.

**Examples**:
- Stages / Arenas
- Game modes
- Environmental settings
- Weather conditions

**Loading**: Loaded after selection is finalized, before game starts.

**Selection**: Players may vote or use a merge algorithm to decide which shared piece to use.

### 3. Personal Pieces
**Selection Strategy**: `personal`

Pieces that each player selects individually. Each player has their own instance.

**Examples**:
- Characters / Fighters
- Decks (in card games)
- Loadouts
- Skins / Cosmetics

**Loading**: Loaded after selection is finalized, before game starts.

**Selection**: Each player chooses their own, independently.

### 4. On-Demand Pieces
**Selection Strategy**: `on demand`

Pieces that are loaded dynamically during gameplay when first needed.

**Examples**:
- Moves / Abilities
- Items
- Effects / Particles
- Weather effects caused by moves
- Status conditions

**Loading**: Loaded the first time they are used in-game.

**Selection**: Not directly selectable by players; loaded based on requirements of other pieces.

## Piece Dependencies

Pieces can require other pieces. This creates a dependency tree.

### Example: Character → Moves → Effects

```
Character (Personal)
  └─ Move: Fireball (On-Demand)
      └─ Effect: Burn (On-Demand)
```

When a character is selected:
1. The character piece is loaded (personal)
2. The character's required moves are NOT loaded yet (on-demand)
3. When the player uses "Fireball" for the first time:
   - The Fireball move is loaded
   - The Burn effect (required by Fireball) is also loaded
4. Subsequent uses of Fireball don't require loading

### Multiple Pieces Sharing Dependencies

```
Move: Fireball → Effect: Burn
Move: Flame Burst → Effect: Burn
Move: Lava Pool → Effect: Burn
```

The Burn effect is only loaded once, even if multiple moves require it.

## Piece Structure

Each piece consists of:

### Metadata
```json
{
  "id": "fire-character",
  "version": {
    "logic": "v1.0.0",
    "media": "v1.0.0",
    "docs": "v1.0.0"
  },
  "humanInfo": {
    "name": "Blaze",
    "author": "Character Designer",
    "url": "https://example.com/characters/blaze",
    "image": "https://example.com/characters/blaze/icon.png"
  },
  "downloadSources": ["https://example.com/pieces/character/fire"],
  "pathVariables": {
    "element": "fire"
  },
  "requiredPieces": {
    "move": {
      "expected": ["fireball", "flame-burst"],
      "selectable": false
    }
  }
}
```

### Assets

Pieces can have multiple asset types:

- **Logic**: JavaScript/WASM code that defines behavior
- **Media**: Images, sounds, videos
- **Docs**: Documentation, tutorials

### Path Variables

Variables that can be used in asset paths for organization:
- `element`: "fire", "water", "grass"
- `style`: "standard", "minimal", "detailed"
- `theme`: "nature", "urban", "space"

## Loading Flow

### Game Start Sequence

1. **Load Mandatory Pieces**
   ```
   Loading: lifebar, ui-elements, core-mechanics
   Status: [████████████████████] 100%
   ```

2. **Player Selection**
   ```
   Player 1: Select Character → Fire
   Player 2: Select Character → Water
   Both: Vote on Stage → Forest
   ```

3. **Load Selected Pieces**
   ```
   Loading Shared: forest-stage
   Loading Personal (P1): fire-character
   Loading Personal (P2): water-character
   Status: [████████████████████] 100%
   ```

4. **Game Ready**
   ```
   All required pieces loaded.
   Connecting to game server...
   Establishing WebRTC connections...
   Game Start!
   ```

5. **During Gameplay (On-Demand)**
   ```
   P1 uses "Fireball"
   → Loading: fireball-move
   → Loading: burn-effect (required by fireball)
   → Loaded in 50ms
   → Execute move
   ```

## Extensibility Examples

### Example 1: Different Game Engines

**Fighting Game Engine**:
- Mandatory: Life bar with super meter
- Shared: Stage
- Personal: Fighter
- On-Demand: Special moves, combos

**Card Game Engine**:
- Mandatory: Mana display, turn timer
- Shared: Board layout
- Personal: Deck
- On-Demand: Card effects, animations

### Example 2: Modding

A modder can create:
1. New characters (personal pieces)
2. New moves for those characters (on-demand pieces)
3. New effects for those moves (on-demand pieces)
4. New stages (shared pieces)

As long as they follow the engine's piece definition, they'll work!

### Example 3: Version Compatibility

Pieces have separate versions for logic and media:
- Logic v1.0.0, Media v1.0.0 (original)
- Logic v1.0.0, Media v2.0.0 (HD texture pack)
- Logic v1.1.0, Media v1.0.0 (balance patch)

Players can mix and match compatible versions.

## Implementation Notes

See `src/piece-loader.ts` for the implementation of the piece loading system.

Example pieces are in `example-pieces/`:
- `lifebar/standard/` - Mandatory piece
- `character/fire/` - Personal piece
- `move/fireball/` - On-demand piece
- `effect/burn/` - On-demand piece (required by fireball)

