# Mugen / Ikemen GO end-to-end example

Drives `@roster-lock/game-launcher-ikemen-go` all the way through match-agent:
login, create/join a room, make a selection, sync + download over the relay,
and **launch two real Ikemen GO windows** on your machine, one connecting to
the other over direct-tcp via a small rendezvous coordinator.

This is an interactive test, not a headless/CI-safe one - it needs a real
Ikemen GO install and a display to actually show the two game windows.

## Prerequisites

- Docker and Docker Compose.
- A local Ikemen GO install, **v1.0.0-rc.2 or newer** (older builds fail to
  load some of this example's characters - see
  `roster-locks/readme.md`'s engine-version table).
- Node/pnpm set up for this monorepo (`pnpm install` at the repo root).

## Running it

```sh
cd examples/mugen/integration
pnpm run cli run --binary-location ~/Games/Ikemen-GO-1.0.0-rc.2/Ikemen_GO_Linux
```

This will:
1. `docker compose up` - download-provider, relay-room, auth-naive,
   titled-room, and direct-ip-coordinator.
2. Build and start a single match-agent (shared by both simulated players,
   same as `examples/full-local`'s own integration script).
3. Install the ikemen-go plugin into match-agent from its local path (it's
   `"private": true`, so this uses `installPlugin`'s local-path install, not
   the npm registry) and point it at `--binary-location`.
4. Register titled-room as a matchmaker and direct-ip-coordinator as a game
   coordinator with relay-room's admin API, then register ikemen-go as an
   allowed game runner with **titled-room's own admin API**
   (`PUT /admin/game-launchers/:pluginName` - engineSha + coordinator id/address)
   - not a static env var (see
   `examples/services/match-makers/titled-room/src/admin/game-launchers.ts`).
5. Register and log in two simulated players against auth-naive, create/join
   a room on titled-room, make a random selection each (matching
   `roster-locks/mugen-simul.roster-lock.json`'s selection config), and mark
   ready.
6. Start the room once both are ready, sync selections and download the real
   MUGEN pieces (`pieces/`) over the relay for both players.
7. Call match-agent's `startGame` for both - one as direct-tcp host, one as
   client - each spawning a real `Ikemen_GO` process, **each from its own
   temp copy of your `--binary-location` install** (see below), one right
   after the other. The client blocks on direct-ip-coordinator until the host
   is confirmed listening before it connects (see
   `plugins/game-launcher/shared/direct-ip-coordinator`).

### Why each player gets its own copy of the install

Two Ikemen processes pointed at the *same* install directory write to its
`save/`/config files concurrently and fail to establish netplay between them
- confirmed by hand (two instances sharing one install failed to connect;
copies of the folder run separately connected fine). `binaryLocation` is a
match-agent-wide setting, and this script shares one match-agent between
both simulated players, so `run.ts` copies your `--binary-location`'s
install into two temp directories at startup and points each player at
their own copy (cleaned up on exit, same as the piece/plugin temp folders).
A real deployment doesn't hit this at all - each physical machine has its
own single real install.

The script then stays running (match-agent needs to keep running for the
game processes it manages) - press Ctrl+C to stop match-agent and tear down
docker compose. The two Ikemen windows keep running independently.

## Fast iteration

```sh
pnpm run cli server-setup   # docker compose up + relay/coordinator/titled-room registration only
```

Useful when you only want the backing services up (e.g. to poke at
titled-room's admin API directly) without running the full player flow.

## Cleaning up

`docker compose down` from `examples/mugen/` (or Ctrl+C on the `run`
command, which does this automatically) removes the docker services.
titled-room and relay-room's D1 data persist across a plain stop/start (not
backed by a volume, but SQLite-on-disk inside the container) - `docker
compose down` + a fresh `up` starts clean.
