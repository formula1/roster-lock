# Pokemon-Style Battle Game for RosterLock Testing

Build a minimal turn-based battle game to test the RosterLock system (matchmaking → selection → download → play pipeline).

## Core Requirements

**Game Flow:**
1. Connect to matchmaker, wait for opponent
2. Selection screen - pick your character
3. Connect to match agent
   - Send personal selection
   - Receive full match manifest (both characters, stage, effects)
4. Prepare game - load ALL pieces into memory upfront (no lazy loading)
5. Connect to game server via WebRTC
6. Play deterministic turn-based battle

**Battle System:**
- 1v1 (one character per player)
- Turn-based, no RNG, deterministic resolution
- Each character has 4 moves baked into their piece
- Simple damage: `damage = move.power * attacker.attack / defender.defense`
- Turn order by speed stat (ties go to player 1)
- Win condition: opponent HP reaches 0
- Both clients resolve turns identically for state sync

## Piece Architecture

- UI - mandatory - for lifebars/move selectors
- Stage - shared - background image, optional music
- Character - personaL - config, sprite, 4 moves
- Move - on demand - config, animation, sound
- Effect - on demand - config, particle effect, sound


**UI Piece (Iframe-Isolated React App):**
- Self-contained HTML app with bundled React code
- Structure: `dist/index.html`, `dist/bundle.js`, `dist/styles.css`, `dist/assets/`
- Loaded into iframe for complete isolation and cleanup
- Communicates with game engine via postMessage
- Contains: LifeBars, TurnIndicator, MoveSelector

**UI Piece Build Output:**
```
ui-pack.tar:
  dist/
    index.html      # Self-contained entry point
    bundle.js       # All React code bundled
    styles.css      # All CSS bundled
    assets/         # Images, fonts, etc.
  manifest.json     # Piece metadata
```

**Stage Piece:**
- Background image, optional music
- Can load different stages for multi-round matches (best-of-X)

**Character Piece (Self-Contained):**
- Config with: id, name, type, stats (hp, attack, defense, speed)
- Back Sprite, Front Sprite
- 4 moves embedded in roster config (no customization)

**Move Piece:**
- Config with: id, name, power, type
- Startup Sprite, Missile Sprite, Hit Sprite
- start sound effect, progress sound effect, hit sound effect
- effects[] in roster config

**Effect Piece:**
- Referenced by moves (multiple moves can share same effect)
- Config with: id, name, duration, { stat affected, stat multiplier }[]
- Overlay sprite that sits over character

## UI Piece Loading (Tauri + Iframe)
```typescript
import { useRef, useMemo, CSSProperties } from 'react'
import { convertFileSrc } from '@tauri-apps/api/tauri'

type UIProps = {
  style: CSSProperties,
  pieceDirectory: string,
  gameState: BattleState,
  onReady: () => void,
  onAction: (action: any) => void,
}

async function UIPiece(props: UIProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const src = useMemo(()=>(convertFileSrc(`${props.pieceDirectory}/dist/index.html`)), [props.pieceDirectory])

  useEffect(()=>{
    window.addEventListener('message', (e) => {
      if (e.source === iframeRef.current.contentWindow) {
        props.onAction(e.data)
      }
    })
  }, [])

  useEffect(()=>{
    if(!iframeRef.current) return;
    iframeRef.current.contentWindow.postMessage({ 
      type: 'gameState', 
      state: props.gameState 
    }, '*')
  }, [props.gameState])
    
  return (
    <iframe
      ref={iframeRef}
      style={props.style}
      src={src}
    />
  )
}

```

**UI Piece Internal Structure (dist/index.html):**
```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="root"></div>
  <script src="bundle.js"></script>
  <script>
    // Listen for game state from parent window
    window.addEventListener('message', (e) => {
      if (e.data.type === 'gameState') {
        updateUI(e.data.state)
      }
    })
    
    // Send user actions to parent window
    function onMoveSelect(moveIndex) {
      window.parent.postMessage({ 
        type: 'moveSelect', 
        moveIndex 
      }, '*')
    }
  </script>
</body>
</html>
```

**Why Iframe:**
- Perfect isolation between UI pieces
- Complete cleanup (remove iframe = all resources freed)
- Natural sandboxing (UI can't interfere with game engine)
- Each match can use different UI piece without memory leaks
- Tauri's `convertFileSrc` serves extracted files seamlessly

## Implementation Notes

**Rendering:**
- Game engine manages canvas/HTML for gameplay layer
- UI piece renders in isolated iframe overlay
- UI communicates via postMessage (state in, actions out)

**Loading Strategy:**
```typescript
// Load everything upfront in preparation phase:
1. Load UI piece (extract, create iframe)
2. Load Stage piece  
3. Load both Character pieces (mine + opponent's)
4. Load all Effect pieces referenced by any move
5. Mount UI iframe, connect postMessage handlers
6. Ready to battle
```

**Turn Resolution (Deterministic):**
```typescript
// Both clients execute identically:
1. Player clicks move in UI iframe
2. UI sends moveSelect via postMessage
3. Game engine sends move to opponent via WebRTC
4. Receive opponent's move
5. Both resolve turn in same order (by speed stat)
6. Apply damage, effects
7. Update UI via postMessage
8. Check win condition
```

**No RNG:** 
- remove accuracy entirely
- Speed is decided by difference of speed stat
  - If a.speed - b.speed >= 50 a goes first
  - If a.speed - b.speed <= -50 b goes first
  - otherwise they both hit at the same time (May cause double KO)
- No critical hits, no random damage ranges

**Type System**
- Yellow is Super effective against Blue
- Blue is Super effective against Red
- Red is Super effective against Yellow

## Tech Stack
- TypeScript/React for game client
- Tauri for filesystem access and serving
- WebRTC for turn exchange
- Iframe for UI piece isolation
- postMessage for UI ↔ game communication

## What This Tests
- Full RosterLock pipeline end-to-end
- UI pieces as isolated React apps with complete cleanup
- Character → Move → Effect dependency chains  
- Loading all pieces upfront
- Deterministic state sync between clients
- Multi-stage rotation
- WebRTC data channels for turn-based gameplay
- Tauri filesystem serving with `convertFileSrc`

## Scope
V1: 1v1, 4 moves per character, simple damage calculation, deterministic
Future: Multiple Stage in a single match, Teams, switching, status effects, items, weather, animations