import * as fs from "fs";
import { test, expect, Page, FrameLocator, Locator, BrowserContext } from "@playwright/test";
import { RosterLockV1Config } from "@roster-lock/types";
import { ProcessGroup } from "../../integration/src/lib/process-utils";
import { dockerComposeUp, dockerComposeDown, setupServers } from "../../integration/src/setupServers";
import { loadEnvVars } from "../../integration/src/lib/env";
import { ROSTER_LOCK_PATH, ENV_VARS_DIR } from "../../integration/src/constants";
import { requiredPickCounts } from "../src/lib/roster";
import { buildMatchAgent, startPlayerMatchAgent, PlayerMatchAgent } from "../src/lib/matchAgentProcess";
import { startViteServer, MATCH_AGENT_CLIENT_PORT, TITLED_ROOM_CLIENT_PORT } from "../src/lib/viteServers";

// Real Ikemen GO install, same prerequisite as
// examples/mugen/integration/src/run.ts's --binary-location (there taken as
// a CLI flag; here an env var, since `playwright test` owns its own CLI args).
const IKEMEN_BINARY_LOCATION = process.env.IKEMEN_BINARY_LOCATION;

const HOST_MATCH_AGENT_PORT = 58810;
const CLIENT_MATCH_AGENT_PORT = 58811;
const MATCH_AGENT_AUTH_CODE = "mugen-playwright-abc123";

const RUN_ID = Date.now();
const HOST_CREDENTIALS = { username: `host-${RUN_ID}`, password: "Password1" };
const CLIENT_CREDENTIALS = { username: `client-${RUN_ID}`, password: "Password1" };
const ROOM_TITLE = `Mugen Playwright ${RUN_ID}`;

const MATCH_AGENT_CLIENT_URL = `http://localhost:${MATCH_AGENT_CLIENT_PORT}`;

let processes: ProcessGroup;
let hostAgent: PlayerMatchAgent;
let clientAgent: PlayerMatchAgent;
let hostContext: BrowserContext;
let clientContext: BrowserContext;
let hostPage: Page;
let clientPage: Page;
let hostFrame: FrameLocator;
let clientFrame: FrameLocator;

const rosterConfig = JSON.parse(fs.readFileSync(ROSTER_LOCK_PATH, "utf-8")) as RosterLockV1Config;
const pickCounts = requiredPickCounts(rosterConfig);

test.beforeAll(async ({ browser }) => {
  test.setTimeout(10 * 60 * 1000);

  if (!IKEMEN_BINARY_LOCATION) {
    throw new Error(
      "IKEMEN_BINARY_LOCATION is not set - point it at a local Ikemen GO v1.0.0-rc.2+ executable " +
      "(see examples/mugen/playwright/README.md)"
    );
  }

  processes = new ProcessGroup();
  processes.registerCleanupOnSignals(dockerComposeDown);

  await dockerComposeUp();
  await buildMatchAgent();

  // titled-room/client defaults VITE_AUTH_SERVICE_URL/VITE_TITLED_ROOM_URL to
  // its own standalone-dev ports (8787/8789, see src/config.ts) when unset -
  // it needs to be pointed at mugen's actual docker-compose services instead.
  const env = loadEnvVars(ENV_VARS_DIR);
  const titledRoomClientEnv = {
    VITE_AUTH_SERVICE_URL: env.PUBLIC_AUTH_SERVICE_URL,
    VITE_TITLED_ROOM_URL: env.PUBLIC_TITLED_ROOM_URL,
  };

  [, , , [hostAgent, clientAgent]] = await Promise.all([
    startViteServer(processes, "match-agent-client", "@roster-lock/match-agent-client", MATCH_AGENT_CLIENT_PORT),
    startViteServer(
      processes, "titled-room-client", "@roster-lock/titled-room-client", TITLED_ROOM_CLIENT_PORT, titledRoomClientEnv
    ),
    setupServers(),
    Promise.all([
      startPlayerMatchAgent(processes, "host", HOST_MATCH_AGENT_PORT, MATCH_AGENT_AUTH_CODE, IKEMEN_BINARY_LOCATION),
      startPlayerMatchAgent(processes, "client", CLIENT_MATCH_AGENT_PORT, MATCH_AGENT_AUTH_CODE, IKEMEN_BINARY_LOCATION),
    ]),
  ]);

  hostContext = await browser.newContext();
  clientContext = await browser.newContext();
  hostPage = await hostContext.newPage();
  clientPage = await clientContext.newPage();
});

test.afterAll(async () => {
  await hostContext?.close();
  await clientContext?.close();
  await processes?.cleanup(dockerComposeDown);
});

test("mugen example end-to-end through the real match-agent-client and titled-room UIs", async () => {
  await test.step("host: connect to match-agent, join settings, log into the matchmaker", async () => {
    hostFrame = await connectAndLogin(hostPage, hostAgent, HOST_CREDENTIALS);
  });

  await test.step("host: create the room", async () => {
    await hostCreateRoom(hostFrame);
  });

  await test.step("client: connect to match-agent, join settings, log into the matchmaker", async () => {
    clientFrame = await connectAndLogin(clientPage, clientAgent, CLIENT_CREDENTIALS);
  });

  await test.step("client: join the room", async () => {
    await clientJoinRoom(clientFrame);
  });

  await test.step("both players select a character+stage and ready up", async () => {
    await Promise.all([
      makeSelection(hostPage, hostFrame),
      makeSelection(clientPage, clientFrame),
    ]);
  });

  await test.step("host starts the match", async () => {
    // Only the room creator sees this button (RoomDetailPage's isHost check) -
    // it's disabled until every participant is ready, so this click also
    // waits out the selection step above finishing on both sides.
    await hostFrame.getByRole("button", { name: "Start Match" }).click({ timeout: 30_000 });
  });

  await test.step("both players download over the relay, start their real game, then close it", async () => {
    await Promise.all([
      downloadAndStartGame(hostPage),
      downloadAndStartGame(clientPage),
    ]);
  });
});

// Waits for `locator` to become visible, calling `retryAction` (e.g. re-clicking a "Connect"
// button) between attempts if it doesn't - up to `attempts` total waits. The first wait covers
// whatever's already in flight (e.g. an auto-connect-on-mount effect); `retryAction` only fires
// before subsequent attempts.
async function retryUntilVisible(
  retryAction: () => Promise<void>, locator: Locator, attempts = 3, perAttemptMs = 20_000
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const visible = await locator.waitFor({ state: "visible", timeout: perAttemptMs }).then(() => true).catch(() => false);
    if (visible) return;
    if (attempt < attempts) await retryAction();
  }
  throw new Error(`Locator never became visible after ${attempts} attempts`);
}

async function connectAndLogin(
  page: Page, matchAgent: PlayerMatchAgent, credentials: { username: string, password: string }
): Promise<FrameLocator> {
  await page.goto(MATCH_AGENT_CLIENT_URL);

  // No dedicated /connect URL to wait for - App.tsx's ConnectOrApp renders
  // ConnectPage standalone (outside the router entirely) whenever
  // disconnected, at whatever URL got loaded, and its autoSubmit effect
  // retries the last-saved (or default) settings first; only once that
  // attempt fails does the form actually become visible (ConnectPage's own
  // `if (autoSubmit && (connecting || !error)) return null`) - a fresh
  // browser context has no saved settings, so this always fails against the
  // default localhost:58732 before this player's real match-agent gets filled
  // in below. fill()'s own actionability wait covers that delay.
  await page.getByLabel("Match Agent URL").fill(matchAgent.url);
  await page.getByLabel("Auth Code").fill(matchAgent.authCode);
  await page.getByRole("button", { name: "Connect", exact: true }).click();

  // A successful connect flips `connected` to true, which mounts
  // <BrowserRouter> for the first time - its root route redirects straight
  // to /match-making now (no "Connected." confirmation or /join-settings
  // stop in between anymore - see App.tsx's ConnectOrApp).
  await expect(page).toHaveURL(/\/match-making$/, { timeout: 15_000 });

  // MatchMakingPage auto-connects to the saved/default matchmaker on mount
  // and its own UI explicitly supports retrying via this same Connect button
  // if that first attempt fails (see its own comment: "A manual Connect
  // button remains below in case this first attempt fails") - a cold vite
  // dev server's very first hit can take long enough (esbuild dependency
  // pre-bundling) to blow through hostBridge.ts's 15s ready-handshake
  // timeout, so retry the same way a real user would rather than assume the
  // very first attempt wins that race.
  const frame = page.frameLocator('iframe[title="Matchmaker"]');
  await retryUntilVisible(
    () => page.getByRole("button", { name: "Connect", exact: true }).click(),
    frame.getByTestId("account-tab-register"),
  );
  await frame.getByTestId("account-tab-register").click();
  await frame.getByLabel("Username").fill(credentials.username);
  await frame.getByLabel("Password").fill(credentials.password);
  await frame.getByTestId("account-submit-register").click();
  // Registration is followed by an automatic login (see titled-room/client's
  // Account.tsx), and then a bridge round-trip to sync identity before the
  // signed-in view (and this button) appears - generous timeout for that.
  await frame.getByTestId("account-continue").click({ timeout: 20_000 });

  await expect(frame.getByRole("heading", { name: "Rooms" })).toBeVisible({ timeout: 15_000 });
  return frame;
}

async function hostCreateRoom(frame: FrameLocator): Promise<void> {
  await frame.getByRole("button", { name: "Create Room" }).click();
  await expect(frame.getByRole("heading", { name: "Create Room" })).toBeVisible();

  await frame.getByLabel("Title").fill(ROOM_TITLE);
  await frame.locator('input[type="file"]').setInputFiles(ROSTER_LOCK_PATH);
  // Min/max players both default to 2 - nothing to fill there. Game Launcher
  // is auto-selected to the one plugin pre-installed on this player's own
  // match-agent (see matchAgentProcess.ts). Team Mode defaults to "single"
  // (gameConfigSchema's own default) regardless of which roster got
  // uploaded - ROSTER_LOCK_PATH's mugen-tag.roster-lock.json needs exactly
  // 3 picks per side, so "single" (1 pick) fails validateSelectionCount
  // unless explicitly overridden here to match.
  await frame.getByLabel("Team Mode").selectOption("tag");

  await frame.getByRole("button", { name: "Create Room" }).click();
  await expect(frame.getByRole("heading", { name: ROOM_TITLE })).toBeVisible({ timeout: 15_000 });
}

async function clientJoinRoom(frame: FrameLocator): Promise<void> {
  await frame.getByRole("link", { name: ROOM_TITLE, exact: true }).click();
  // RoomDetailPage auto-joins on mount if not already a participant - no
  // separate "join" button exists.
  await expect(frame.getByRole("heading", { name: ROOM_TITLE })).toBeVisible({ timeout: 15_000 });
}

async function makeSelection(page: Page, frame: FrameLocator): Promise<void> {
  await frame.getByRole("button", { name: "Make Selection" }).click();

  // Resolves through the *host* page's lightbox, not the iframe -
  // bridge.requestSelection (guest) becomes the host's
  // pendingLightbox: { type: "selection" } (bridge/hostBridge.ts), rendered
  // as SelectionBoard on the top-level match-agent-client page.
  const board = page.locator(".selection-board");
  await expect(board).toBeVisible({ timeout: 15_000 });

  // Only one piece type's cards are mounted at a time now - SelectionBoard
  // tabs between them (PieceTypeTabs) instead of stacking every type's
  // section in the DOM simultaneously, and there's no ".piece-type-name"
  // anymore (the type name is just the tab button's own text, aside from
  // its aria-hidden ready-dot). Switch to each type's tab before clicking
  // its cards - only one ".piece-type-section" exists at a time, so no
  // further scoping by type is needed once its tab is active.
  for (const [pieceType, count] of Object.entries(pickCounts)) {
    await board.getByRole("button", { name: pieceType, exact: true }).click();
    const cards = board.locator(".piece-type-section .piece-card");
    for (let i = 0; i < count; i++) {
      await cards.nth(i).click();
    }
  }

  await page.getByRole("button", { name: "Confirm Selection" }).click();
  await expect(frame.getByText("Waiting for other players...")).toBeVisible({ timeout: 15_000 });
}

async function downloadAndStartGame(page: Page): Promise<void> {
  // No explicit action needed for the redirect here - RoomDetailPage's own
  // websocket receives GAME_HAS_STARTED and calls bridge.initiateRelay
  // automatically once the host starts the match, which this page's
  // onInitiateRelay turns into navigate("/download").
  await expect(page.getByRole("heading", { name: "Downloading" })).toBeVisible({ timeout: 30_000 });

  // No click needed - DownloadPage starts the game itself as soon as the
  // real tar download over the relay finishes. Generous timeout: the
  // direct-tcp *client* party blocks server-side on the coordinator until
  // the host confirms listening (see examples/mugen/README.md), on top of
  // the download itself.
  await expect(page.getByRole("heading", { name: "Games" })).toBeVisible({ timeout: 5 * 60 * 1000 });
  const row = page.locator(".game-process-row").first();
  await expect(row).toContainText("Running", { timeout: 30_000 });

  // SKIP_CLOSE=1 leaves both real Ikemen windows running after the test
  // finishes, for manual inspection (e.g. confirming the two sides actually
  // connected over direct-tcp) - not the default, since an automated suite
  // needs to leave a clean slate for the next run.
  if (process.env.SKIP_CLOSE) return;

  // Let the real Ikemen GO window actually run for a bit before closing it.
  await page.waitForTimeout(15_000);

  await row.getByRole("button", { name: "Close" }).click();
  await expect(row).toContainText(/Exited/, { timeout: 15_000 });
}
