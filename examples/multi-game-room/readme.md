# Multi-Game Room Example

Room-based (advertised-room) matchmaking with a pluggable games registry, so a
single Room Match Maker can serve multiple engines/plugins (Ikemen GO today,
others later) instead of one match-agent hardcoding one game.

This lives under `examples/` (following `examples/full-local`'s precedent) and
may move into `core/` once the design settles. Design notes live in
`docs/v2/ikemen-go/general-plan.md` and `ui.md`.

## Pieces

- **`services/room-match-maker`** - the only new server here. Admin-managed
  games registry (`POST`/`DELETE /admin/games`, bearer-token gated; public
  read at `GET /games`) plus the advertised-room user API: `POST /rooms`,
  `GET /rooms`, `GET /rooms/:id`, `GET /rooms/:id/connection`,
  `POST /rooms/:id/join`, `POST /rooms/:id/selection-ready` - each signed the
  same way `examples/full-local/services/matchmaking` signs its requests.
  `GET /rooms/:id/connection` exists because a room only stores one
  creator-supplied connection setup, but the creator (always host) and every
  other participant (always client) need a *different* `ConnectionConfig`
  resolved from it - see `src/utils/connection.ts`.
- **`@roster-lock/game-runner-ikemen-go`** (`plugins/game-runner/ikemen-go`) -
  the plugin this registry points rooms at for Ikemen. Not part of this
  package, but the two are meant to be exercised together.
- **relay room + game coordinator** - intentionally *not* duplicated here.
  Point `RELAY_SERVER_URL`/`GAME_COORDINATOR_ID` at the ones already stood up
  in `examples/full-local` (or a real deployment) rather than standing up a
  second copy - room-match-maker only needs to register itself as a
  matchmaker against an existing Relay Room service, the same way
  `examples/full-local/services/matchmaking` does.

## How a match actually starts

Room Match Maker only gets a room to the point of "here's a Relay Room to
connect to" - it never spawns a game process itself, deliberately: it's a
hosted service, and the game (Ikemen or otherwise) has to run on each
player's own machine. The last mile is a client-side responsibility, mirroring
`examples/full-local/game/game-headless`'s `steps/index.ts`:

1. Create/join/ready-up against room-match-maker (this package). Once
   `selection-ready` reports `allReady`, the room carries `{ relay: { roomId, url } }`.
2. Fetch `GET /rooms/:id/connection` (signed) to get *this* machine's own
   `ConnectionConfig` - host or client, resolved server-side.
3. Run the existing relay+download flow against the relay room (unchanged -
   same `@roster-lock/ts-client` sync-download used by every other example)
   to get a `RosterLockV1SyncDLResult`.
4. Call `pluginManager.gameRunner.startGame("ikemen-go", binaryLocation,
   connectionConfig, args)`, where `args` (`StartGameArgs`) is built from the
   relay room id, this machine's identity/keys, the room's player list,
   the sync-download result, the roster config, local match-agent connection
   info, and the room's shared `gameConfig` (team mode, round time, etc).
   `binaryLocation` comes from this machine's own local settings, never from
   the room.

No client example is included yet - only the server side and the plugin type
exist so far.

## Known gaps

- **`room` connection mode has no bridge.** `ikemen-go` only claims
  `direct-tcp` in `supportedConnectionModes` - `room` needs something that
  tunnels Ikemen's TCP connection over the room's real transport (WebRTC data
  channel / websocket / whatever a given Room Algorithm turns out to be), and
  that doesn't exist yet. See that plugin's readme.
- **No docker-compose wiring yet** for `room-match-maker` (unlike
  `examples/full-local`'s services, which each have a `Dockerfile` + compose
  entry). `env-vars/room-match-maker.env` exists but isn't wired into a
  compose file yet.
- **No Ikemen roster-lock engine config** has been authored yet - the plugin
  assumes piece types named exactly `character` and `stage` (see the plugin's
  readme), but nothing has published a config using those names.
- **`maxPlayers` is only bounded below (2), not above.** `general-plan.md`
  calls for an upper bound from the selection config's own player maximum,
  but nothing here is selection-config-aware yet.
- **No accounts, bans, or chat.** Identity is still a bare per-session
  keypair, same as `examples/full-local/services/matchmaking` - see the
  "Persistent accounts" discussion in `general-plan.md` before building
  `ui.md`'s user-management pages, since a ban isn't enforceable against a
  self-generated key without an account layer underneath it.
- **Games registry and rooms are in-memory**, matching
  `examples/full-local/services/matchmaking`'s pattern - fine for an example,
  not for a real deployment.
