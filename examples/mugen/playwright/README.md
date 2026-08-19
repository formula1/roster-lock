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

## What each step does

The single test in `tests/mugen.spec.ts` walks both simulated players
through every page a real player would see, as a sequence of `test.step`
blocks. Each step below names which app/page it happens on -
`match-agent-client` is the top-level page each player has open the whole
time; `titled-room/client` only exists inside its
`<iframe title="Matchmaker">`.

1. **Connect** (`match-agent-client`, `/connect`) - fill in this player's
   own match-agent URL + auth code (each simulated player gets its own
   match-agent process on its own port, already running by this point - see
   `src/lib/matchAgentProcess.ts`), click **Connect**, wait for the
   "Connected." confirmation, click **Continue**.
2. **Join settings** (`/join-settings`) - click **Continue** with nothing
   else to fill in. This page is normally where a real player points their
   own game-runner plugin at a local binary; for this test that's already
   done by `startPlayerMatchAgent` before the browser ever opens.
3. **Match making** (`/match-making`) - click **Connect**, which loads
   `titled-room/client` into this page's matchmaker `<iframe>`.
4. **Register/login** (`titled-room/client`, inside the iframe) - switch to
   the register tab, fill in a per-run username/password, submit.
   Registration auto-logs the new account in; a following bridge round-trip
   syncs identity back to the host page before the signed-in Rooms view
   appears, so the click on **Continue** carries a generous timeout to wait
   that out.
5. **Rooms list** (iframe) - the host clicks **Create Room**, fills in a
   title, and uploads the example's published roster lock JSON as the
   room's file. Min/max players and the game runner are left at their
   defaults (2 players; whichever single game-runner plugin is pre-installed
   on this player's match-agent - see `REQUIRED_PLUGINS` in
   `matchAgentProcess.ts`). Submitting lands on that room's detail page. The
   client player instead clicks the room's own title link from the list -
   `RoomDetailPage` auto-joins on mount, there's no separate "Join" button.
6. **Room detail, make a selection** (iframe) - both players click **Make
   Selection**. This doesn't open anything inside the iframe:
   `bridge.requestSelection` becomes the *host page's* own
   `pendingLightbox` state (`core/match-agent/client/src/bridge/hostBridge.ts`),
   rendered as a `SelectionBoard` lightbox directly on top of
   `match-agent-client`, not inside the matchmaker frame itself. Each
   pickable piece type gets its minimum required number of `.piece-card`
   clicks (`requiredPickCounts` in `src/lib/roster.ts` reads the same
   per-type minimums `SelectionBoard` itself enforces from the roster
   lock's `selection` config), then **Confirm Selection**. The room detail
   page then shows "Waiting for other players..." until both sides have
   confirmed.
7. **Start the match** (iframe, host only) - once both players are ready,
   the host's **Start Match** button (only the room creator sees it -
   `RoomDetailPage`'s `isHost` check) becomes enabled; clicking it also
   implicitly waits out step 6 finishing on both sides, since the button
   stays disabled until then.
8. **Download** (`match-agent-client`, `/download`) - no click needed.
   Each player's own websocket receives `GAME_HAS_STARTED`,
   `bridge.initiateRelay` fires automatically, and `onInitiateRelay`
   navigates here, showing a "Downloading" heading while the real roster
   pieces (characters/stage) come down over the relay as a tar archive.
9. **Game running** (`match-agent-client`, the "Games" heading) - once the
   download finishes, `DownloadPage` starts the real Ikemen process itself,
   no click needed. The test waits for a `.game-process-row` to report
   "Running".
10. **Close the game** - after a 15s pause (so the real Ikemen window
    visibly runs for a bit), the test clicks **Close** on that row and
    waits for it to report "Exited". Set `SKIP_CLOSE=1` to skip this step
    and leave both real Ikemen windows open for manual inspection instead
    (e.g. to confirm the two sides actually connected to each other over
    direct-tcp).
