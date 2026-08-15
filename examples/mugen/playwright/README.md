# Mugen Playwright end-to-end test

Drives the *real* browser UIs through the mugen example, for two simulated
players: `core/match-agent/client` (the host shell each player runs locally)
with `examples/services/match-makers/titled-room/client` loaded in its
matchmaker `<iframe>`. Unlike `examples/mugen/integration/src/run.ts`, which
simulates both players with direct HTTP calls, this suite clicks through the
same pages a real player would - connect, join settings, log in, create/join
a room, pick a character+stage, ready up, download over the relay, and start
a real Ikemen GO process - then closes that process again from the app's own
`/game` page.

This is the same kind of test `run.ts` already documents itself as *not*
being safe for CI/headless: it launches real `Ikemen_GO` processes and needs
a real display.

## Prerequisites

- Docker and Docker Compose.
- A local Ikemen GO install, v1.0.0-rc.2 or newer (same requirement as
  `examples/mugen/integration`'s README - older builds fail to load some of
  this example's characters).
- Node/pnpm set up for this monorepo (`pnpm install` at the repo root).
- Playwright's browser binary, once: `pnpm exec playwright install chromium`.

## Running it

```sh
IKEMEN_BINARY_LOCATION=~/Games/Ikemen-GO-1.0.0-rc.2/Ikemen_GO_Linux pnpm test
```

This brings up the same docker services `run.ts` does (download-provider,
relay-room, auth-naive, titled-room, direct-ip-coordinator), builds and
starts one match-agent process per simulated player (each with its own copy
of `IKEMEN_BINARY_LOCATION`'s install - two real Ikemen processes sharing one
install directory corrupt each other's save/config state), starts
`core/match-agent/client` and `titled-room/client`'s vite dev servers, and
then drives two browser contexts through the full flow described above.
Teardown (both match-agent subprocesses, both vite servers, `docker compose
down`) runs automatically once the test finishes, whether it passed or
failed.

Runs headed, not headless - the real Ikemen windows need a display either
way, so there's no headless path worth preserving here.
