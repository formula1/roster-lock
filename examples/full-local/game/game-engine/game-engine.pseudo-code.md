
# Game Concept

## Sync Step
Before gameplay begins, all clients sync in two phases:
1. **syncRandom** — commit/reveal/verify random seeds so all clients derive the same `getRandom()` sequence
2. **syncListeners** — stage and characters register their event listeners before `onGameStart` fires

## GameGlobal
```typescript
interface GameGlobal {
  getRandom(): number           // float [0, 1) — deterministic across all clients via synced seed
  onGameStart: GameEvent        // fires once before the first turn
  onTurnStart: GameEvent        // fires at the start of each turn
  onTurnEnd: GameEvent          // fires at the end of each turn
}
```
> Note: consider patching `Math.random = gameGlobal.getRandom` after sync so third-party move logic is also deterministic.

## GameEvent
```
GameEvent.emit()
  1. sort listeners by shared value (listeners with the same value are peers)
  2. within each peer group, shuffle with getRandom()
  3. run each listener in that order
  4. checkState() after each listener runs
```

---

# Game Lifecycle

## Before Game Starts
- Stage and characters subscribe to `onGameStart`, `onTurnStart`, `onTurnEnd`
- After all listeners are registered → `gameGlobal.onGameStart.emit()`

## Turn
```
1. Commit/Reveal/Verify moves   <- all players lock in their move secretly, then reveal
2. onTurnStart.emit()
3. Resolve moves by speed       <- see "Run Turn" below
4. onTurnEnd.emit()
```

---

# Speed System

A character's speed stat can be fractional. The integer part is the guaranteed speed,
the fractional part is a probability of gaining +1 speed (resolved via `getRandom()`).

```typescript
function getSpeed(speed: number): number {
  const baseSpeed = Math.floor(speed);
  const randSpeed = speed % 1;
  if (randSpeed === 0) return baseSpeed;
  const additionalSpeed = gameGlobal.getRandom() < randSpeed ? 1 : 0;
  return baseSpeed + additionalSpeed;
}
```

---

# Run Turn — Simultaneous Resolution (MTG-style)

Moves are grouped by resolved speed. Within a speed group, **all effects are collected first,
then applied at the same time**. This means two characters at the same speed can kill each
other simultaneously — resulting in a tie rather than one dying first.

```typescript
type MoveDescription = {
  player: string,
  character: Character,
  move: Move,
}

function runTurn(moves: Array<MoveDescription>) {
  // 1. Resolve each character's speed
  const speedPoints = new Map<number, Array<MoveDescription>>();
  for (const moveDesc of moves) {
    const speed = getSpeed(moveDesc.character.speed);
    ensureKey(speedPoints, speed, []).push(moveDesc);
  }

  gameGlobal.onTurnStart.emit();

  // 2. Execute highest speed first; same-speed moves resolve simultaneously
  for (const speed of Array.from(speedPoints.keys()).sort((a, b) => b - a)) {
    const group = speedPoints.get(speed)!;

    // Collect all effects from every move in this group (no application yet)
    const effects: Array<Effect> = [];
    for (const moveDesc of group) {
      effects.push(...resolveMove(moveDesc));
    }

    // Apply all effects at the same time — MTG-style simultaneous damage/healing
    applyEffects(effects);

    // Check win/loss/tie after each speed group resolves
    checkState(); // may detect tie if both sides reach 0 HP simultaneously
  }

  gameGlobal.onTurnEnd.emit();
}
```

## checkState — Simultaneous Tie Detection
```typescript
function checkState(): 'ongoing' | 'win' | 'loss' | 'tie' {
  const dead = characters.filter(c => c.health <= 0);
  if (dead.length === 0) return 'ongoing';
  if (dead.length === characters.length) return 'tie';   // all died at the same time
  return dead.some(c => c.player === localPlayer) ? 'loss' : 'win';
}
```

---

# Helpers

```typescript
function ensureKey<K, T>(map: Map<K, T>, key: K, defaultValue: T): T {
  if (map.has(key)) return map.get(key)!;
  map.set(key, defaultValue);
  return defaultValue;
}
```
