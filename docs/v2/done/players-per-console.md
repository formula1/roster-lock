# Multiple Players per Computer
Some games, like super smash bros, support more than 2 players on one console. At the moment, roster lock expects only one player per console, however this needs to be updated.

We need to be able to handle an arbitrary mix of players per console 2v2v1v1, 3v1v3

## Status: plumbing done, UI + arbitrary matchmaking still open

The vocabulary is now split into **machine** (one relay connection, one
keypair - `RoomMachine`/`WebSocketAttachment` in relay-server) and **player**
(one local selection participant, identified as `${machinePublicKey}:${index}`
downstream in match-agent/`runSelection`). A machine declares a `playerCount`
when it joins matchmaking; that count travels through room creation to the
relay (`RoomConfig.machines[].playerCount`, returned by `GET /machines`) and
match-agent validates a machine's submitted player selections against it
before merging them into the room's final selection.

Done:
- `core/types`, `core/shared`: `PlayerId` type, `playerSelections`/
  `ownSelections` request shapes (keyed by local player index).
- `core/match-agent`: one machine can submit N local players' selections
  over its single relay connection; player count is validated per machine.
- `core/relay-server`: machine/player vocabulary split, `playerCount` carried
  on each room machine. The relay's socket-per-machine model and wire
  protocol are unchanged - it never inspects the encrypted payload.
- `client/typescript`, `examples/full-local` matchmaking/game-headless/
  game-pwa: updated to the renamed fields end to end.

Explicitly not done yet:
- **game-pwa UI** to let a player declare more than one local controller and
  collect multiple selections in the browser - every example client today
  still sends exactly one player's selection per machine.
- **Arbitrary N-machine matchmaking** (2v2v1v1, 3v1v3) - matchmaking still
  pairs exactly 2 machines per room; each machine can bring >1 player, but
  team/machine-count balancing beyond 2 machines is unbuilt.
- Matchmaking's `/join` currently doesn't even accept a client-declared
  `playerCount` - every machine is assumed to have exactly 1 player at the
  matchmaking layer today (`queue.ts` hardcodes `playerCount: 1` when
  building the room). The relay/match-agent plumbing above already supports
  higher counts; only matchmaking's queue and the game clients need to
  actually let a machine declare more.

