import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { chromium, Page, FrameLocator, Locator } from "@playwright/test";
import { RosterLockV1Config } from "@roster-lock/types";
import { ProcessGroup } from "../../integration/src/lib/process-utils";
import { dockerComposeDown, setupServers } from "../../integration/src/setupServers";
import { loadEnvVars } from "../../integration/src/lib/env";
import { ROSTER_LOCK_PATH, ENV_VARS_DIR, REPO_ROOT, MUGEN_DIR } from "../../integration/src/constants";
import { requiredPickCounts } from "../src/lib/roster";
import { buildMatchAgent, preparePlayerMatchAgent, PlayerMatchAgent, IKEMEN_PLUGIN_NAME } from "../src/lib/matchAgentProcess";
import { startViteServer, MATCH_AGENT_CLIENT_PORT, TITLED_ROOM_CLIENT_PORT } from "../src/lib/viteServers";

// Same shape as tests/mugen.spec.ts, but driven as a plain script instead of
// through the playwright test-runner lifecycle - that lifecycle's afterAll
// closes both browser contexts and kills match-agent/vite/docker the moment
// the test body returns, which is exactly wrong for a demo recording: we
// want everything left open once the game starts, not torn down.
//
// Unlike mugen.spec.ts (and this script's own earlier version), docker
// compose and each player's match-agent run in their own real terminal
// windows here rather than as background children whose output gets
// multiplexed into this process's own stdout - for a recording, each of
// those is its own visible step, not a log line. This process only spawns
// the terminals and polls for readiness (an HTTP health check for
// match-agent, a sentinel file for docker compose) rather than owning them.

const IKEMEN_BINARY_LOCATION = process.env.IKEMEN_BINARY_LOCATION;
const HOST_MATCH_AGENT_PORT = 58910;
const CLIENT_MATCH_AGENT_PORT = 58911;
const MATCH_AGENT_AUTH_CODE = "mugen-demo-abc123";

// Fixed rather than mkTempDir's random suffix - these need to be known
// up front so they can be baked into the `listen` command run in each
// match-agent's own terminal, not just visible to this process.
const DEMO_TMP_ROOT = path.join(os.tmpdir(), "mugen-demo");
const DOCKER_READY_SENTINEL = path.join(DEMO_TMP_ROOT, "docker-compose-ready");

const RUN_ID = Date.now();
const HOST_CREDENTIALS = { username: `host-${RUN_ID}`, password: "Password1" };
const CLIENT_CREDENTIALS = { username: `client-${RUN_ID}`, password: "Password1" };
const ROOM_TITLE = `Mugen Demo ${RUN_ID}`;
const MATCH_AGENT_CLIENT_URL = `http://localhost:${MATCH_AGENT_CLIENT_PORT}`;

async function positionWindow(page: Page, left: number, top: number, width: number, height: number): Promise<void> {
  const session = await page.context().newCDPSession(page);
  const { windowId } = await session.send("Browser.getWindowForTarget");
  await session.send("Browser.setWindowBounds", { windowId, bounds: { left, top, width, height, windowState: "normal" } });
}

const execFileAsync = promisify(execFile);

// xdotool (and any X11 app it targets) misbehaves when it inherits this dev environment's own
// GTK/pixbuf module-path env vars (see cleanSpawnEnv in integration/src/lib/process-utils.ts for
// the match-agent/Ikemen side of the same issue) - a *fully* minimal env, not just those vars
// stripped, is what's actually confirmed reliable for xdotool's own window-focus/move targeting.
// Also used for the xterm windows themselves below, for the same reason.
function minimalX11Env(): NodeJS.ProcessEnv {
  const keep = ["HOME", "DISPLAY", "XAUTHORITY", "WAYLAND_DISPLAY", "XDG_RUNTIME_DIR", "PATH"];
  const env: NodeJS.ProcessEnv = {};
  for (const key of keep) if (process.env[key]) env[key] = process.env[key];
  return env;
}

async function xdotool(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("xdotool", args, { env: minimalX11Env() });
  return stdout.trim();
}

function shellQuote(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

// Runs `command` in its own real xterm window (not captured/piped back into this process) - for
// a recording, docker compose and each match-agent need to be their own visible terminal, not a
// log line multiplexed into this script's own stdout. Fire-and-forget: this process only polls
// for readiness afterward (see waitForSentinelFile/preparePlayerMatchAgent's own waitForHttpOk),
// it never owns these as child processes the way ProcessGroup does for background work.
function runInXterm(title: string, geometry: string, command: string): void {
  const script = `${command}; echo; echo "=== press enter to close ==="; read`;
  const child = spawn(
    "xterm",
    ["-title", title, "-geometry", geometry, "-fa", "Monospace", "-fs", "12", "-bg", "black", "-fg", "white", "-e", "bash", "-c", script],
    { env: minimalX11Env(), detached: true, stdio: "ignore" }
  );
  child.unref();
}

// xterm's own -geometry flag is only a hint the window manager is free to ignore or adjust (seen
// firsthand: xterms have landed overlapping despite distinct -geometry values) - an explicit
// xdotool windowmove afterward, the same mechanism positionIkemenWindow below already relies on,
// is what's actually reliable. Retries since the window may not exist yet right after spawn.
async function positionXtermWindow(title: string, x: number, y: number, attempts = 20, delayMs = 300): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const ids = (await xdotool("search", "--name", title).catch(() => "")).split("\n").filter(Boolean);
    if (ids[0]) {
      await xdotool("windowmove", ids[0], String(x), String(y));
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`No window titled "${title}" found after ${attempts} attempts`);
}

async function waitForSentinelFile(filePath: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(filePath)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${filePath}`);
}

// Ikemen creates two X11 windows per process: an invisible stub (no
// _NET_WM_ALLOWED_ACTIONS at all) and the real rendering surface (has
// _NET_WM_ACTION_MOVE) - confirmed by hand while diagnosing why moving "the" window did nothing
// visually (the stub moved, the real content window - stacked exactly on top of the other
// player's - never did). Only the latter is worth finding/moving.
async function findRealIkemenWindow(pid: number, attempts = 20, delayMs = 500): Promise<string> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const ids = (await xdotool("search", "--pid", String(pid)).catch(() => "")).split("\n").filter(Boolean);
    for (const id of ids) {
      const { stdout } = await execFileAsync(
        "xprop", ["-id", id, "_NET_WM_ALLOWED_ACTIONS"], { env: minimalX11Env() }
      ).catch(() => ({ stdout: "" }));
      if (stdout.includes("_NET_WM_ACTION_MOVE")) return id;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`No movable Ikemen GO window found for pid ${pid} after ${attempts} attempts`);
}

async function findIkemenPid(installDir: string, attempts = 20, delayMs = 500): Promise<number> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const pid = await execFileAsync("pgrep", ["-f", installDir]).then(
      ({ stdout }) => Number(stdout.trim().split("\n")[0]), () => null
    );
    if (pid) return pid;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`No Ikemen GO process found under ${installDir} after ${attempts} attempts`);
}

async function positionIkemenWindow(installDir: string, x: number, y: number): Promise<string> {
  const pid = await findIkemenPid(installDir);
  const windowId = await findRealIkemenWindow(pid);
  await xdotool("windowmove", windowId, String(x), String(y));
  return windowId;
}

// Ikemen's VS screen doesn't advance on its own no matter how long you wait - confirmed by hand
// earlier in this project: it sits frozen until a real button press skips it into "Round 1"
// (Return/z both work as a stand-in for a real controller's start button). Without this, holding
// an arrow key afterward moves nothing - the match simply isn't live yet.
async function skipVersusScreen(windowId: string): Promise<void> {
  await xdotool("windowactivate", windowId);
  await new Promise((resolve) => setTimeout(resolve, 150));
  await xdotool("key", "Return");
  await xdotool("key", "z");
}

// Briefly focuses `windowId` and holds `key` down for `holdMs` - visible proof (for a recording)
// that each side's window is live and independently taking real input, not a static image. Tight
// timings on purpose: long enough to read as a deliberate hold on camera, short enough that
// switching between both windows doesn't drag.
async function demoArrowKeyHold(windowId: string, key: string, holdMs: number): Promise<void> {
  await xdotool("windowactivate", windowId);
  await new Promise((resolve) => setTimeout(resolve, 150));
  await xdotool("keydown", key);
  await new Promise((resolve) => setTimeout(resolve, holdMs));
  await xdotool("keyup", key);
}

async function waitForText(locator: Locator, text: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const content = await locator.textContent().catch(() => null);
    if (content?.includes(text)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for text "${text}"`);
}

// Waits for `locator` to become visible, calling `retryAction` (e.g. re-clicking a "Connect"
// button) between attempts if it doesn't - up to `attempts` total waits. Mirrors
// tests/mugen.spec.ts's own copy: a cold vite dev server's first hit can outlast
// hostBridge.ts's 15s ready-handshake timeout, so retry the same way a real user would.
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

  // No dedicated /connect URL/"Connected." confirmation to wait for anymore - App.tsx's
  // ConnectOrApp redirects straight to /match-making on a successful connect (see
  // tests/mugen.spec.ts's connectAndLogin for the full explanation).
  await page.getByLabel("Match Agent URL").fill(matchAgent.url);
  await page.getByLabel("Auth Code").fill(matchAgent.authCode);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.waitForURL(/\/match-making$/, { timeout: 15_000 });

  const frame = page.frameLocator('iframe[title="Matchmaker"]');
  await retryUntilVisible(
    () => page.getByRole("button", { name: "Connect", exact: true }).click(),
    frame.getByTestId("account-tab-register"),
  );
  await frame.getByTestId("account-tab-register").click();
  await frame.getByLabel("Username").fill(credentials.username);
  await frame.getByLabel("Password").fill(credentials.password);
  await frame.getByTestId("account-submit-register").click();
  await frame.getByTestId("account-continue").click({ timeout: 20_000 });

  await frame.getByRole("heading", { name: "Rooms" }).waitFor({ timeout: 15_000 });
  return frame;
}

// Drives the real "missing game launcher -> Install" flow on titled-room/client's Create Room
// page (examples/mugen/services/titled-room/client/src/pages/Rooms/Create.tsx) - not a
// programmatic install call. Clicking "Install" there sends a bridge request that opens
// InstallGameLauncherLightbox as a lightbox on this same top-level match-agent-client `page`
// (not inside the iframe - see core/match-agent/client/src/pages/MatchMaking/index.tsx), which
// does the actual install, then reuses GameLauncherSettingsForm (the same form
// /game-launcher/:pluginName uses standalone) to set binaryLocation before resolving.
async function installIkemenPluginViaUI(page: Page, frame: FrameLocator, binaryLocation: string): Promise<void> {
  await frame.locator(".missing-plugins li", { hasText: IKEMEN_PLUGIN_NAME })
    .getByRole("button", { name: "Install", exact: true }).click();

  // Scoped to .lightbox-box (see core/match-agent/client/src/components/Lightbox.tsx) - "Save"
  // alone also matches pages/MatchMaking/index.tsx's own unrelated handleSaveCurrent button,
  // which stays mounted underneath this lightbox overlay the whole time.
  const lightbox = page.locator(".lightbox-box");
  await lightbox.getByRole("heading", { name: `Install ${IKEMEN_PLUGIN_NAME}` }).waitFor({ timeout: 15_000 });
  // InstallGameLauncherLightbox starts on a confirm step - nothing installs until this is
  // clicked (the embedding game picked this plugin name, not the user).
  await lightbox.getByRole("button", { name: "Install", exact: true }).click();
  // The settings form only renders once the install itself finishes (installing state flips).
  await lightbox.getByLabel("Binary location").waitFor({ timeout: 30_000 });
  await lightbox.getByLabel("Binary location").fill(binaryLocation);
  await lightbox.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(1_000);
  await lightbox.getByRole("button", { name: "Done" }).click();
}

async function hostCreateRoom(page: Page, frame: FrameLocator, binaryLocation: string): Promise<void> {
  await frame.getByRole("button", { name: "Create Room" }).click();
  await frame.getByRole("heading", { name: "Create Room" }).waitFor();

  await installIkemenPluginViaUI(page, frame, binaryLocation);

  await frame.getByLabel("Title").fill(ROOM_TITLE);
  await frame.locator('input[type="file"]').setInputFiles(ROSTER_LOCK_PATH);
  // Team Mode defaults to "single" regardless of which roster got uploaded -
  // ROSTER_LOCK_PATH's mugen-tag.roster-lock.json needs exactly 3 picks per
  // side, so it has to be explicitly overridden here to match (see
  // tests/mugen.spec.ts's hostCreateRoom for the full explanation).
  await frame.getByLabel("Team Mode").selectOption("tag");

  await frame.getByRole("button", { name: "Create Room" }).click();
  await frame.getByRole("heading", { name: ROOM_TITLE }).waitFor({ timeout: 15_000 });
}

async function clientJoinRoom(frame: FrameLocator): Promise<void> {
  await frame.getByRole("link", { name: ROOM_TITLE, exact: true }).click();
  await frame.getByRole("heading", { name: ROOM_TITLE }).waitFor({ timeout: 15_000 });
}

// Picks `count` distinct random indices out of `total` (Fisher-Yates partial shuffle) - a fresh
// random hand each run makes for a more convincing demo than always grabbing the same first N
// cards.
function pickRandomIndices(total: number, count: number): Array<number> {
  const indices = Array.from({ length: total }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count);
}

// Matches plugins/game-launcher/ikemen-go/src/pieceTypes.ts's own STAGE_PIECE_TYPE - not
// imported from there since record-demo.ts otherwise has no dependency on that plugin's package,
// just the roster config's own piece-type key.
const STAGE_PIECE_TYPE = "stage";

async function makeSelection(
  page: Page, frame: FrameLocator, pickCounts: Record<string, number>, stagePieceName: string
): Promise<void> {
  await frame.getByRole("button", { name: "Make Selection" }).click();

  const board = page.locator(".selection-board");
  await board.waitFor({ timeout: 15_000 });

  // SelectionBoard now shows one piece type at a time via a shared tab bar
  // (PieceTypeTabs) rather than stacking every type's section at once - the
  // old per-section ".piece-type-name" label this used to filter on is gone
  // entirely (PieceTypeSection's header is just a pick-count now). Switch
  // tabs by the tab button's own accessible name (its dot span is
  // aria-hidden, so the name is exactly the piece type) and then click
  // straight in ".piece-type-section", since only the active type's cards
  // are mounted at all.
  for (const [pieceType, count] of Object.entries(pickCounts)) {
    await board.getByRole("button", { name: pieceType, exact: true }).click();
    const cards = board.locator(".piece-type-section .piece-card");
    await cards.first().waitFor({ timeout: 15_000 });

    if (pieceType === STAGE_PIECE_TYPE) {
      // Stage picks a specific named variant instead of a random index - see main() for why
      // (host and client are always assigned the two non-default variants, never the same one,
      // so the room's democracy-random tie-break always has to pick between exactly those two).
      await cards.filter({ hasText: stagePieceName }).click();
      continue;
    }

    // Clicking a card just toggles its own data-selected attribute in place (see
    // core/match-agent/client/src/components/Selection/PieceCard.tsx) - the list never reorders
    // or removes entries, so indices picked up front against the initial count stay valid
    // through every click below.
    const total = await cards.count();
    for (const index of pickRandomIndices(total, count)) {
      await cards.nth(index).click();
    }
  }

  await page.getByRole("button", { name: "Confirm Selection" }).click();
  await waitForText(frame.locator("body"), "Waiting for other players...", 15_000);
}

async function waitForGameRunning(page: Page): Promise<void> {
  await page.getByRole("heading", { name: "Downloading" }).waitFor({ timeout: 30_000 });
  await page.getByRole("heading", { name: "Games" }).waitFor({ timeout: 5 * 60 * 1000 });
  const row = page.locator(".game-process-row").first();
  await waitForText(row, "Running", 30_000);
}

async function main(): Promise<void> {
  if (!IKEMEN_BINARY_LOCATION) {
    throw new Error(
      "IKEMEN_BINARY_LOCATION is not set - point it at a local Ikemen GO v1.0.0-rc.2+ executable"
    );
  }

  const processes = new ProcessGroup();
  processes.registerCleanupOnSignals(dockerComposeDown);

  console.log("[demo] preparing fresh per-player temp folders");
  fs.rmSync(DEMO_TMP_ROOT, { recursive: true, force: true });
  const hostFolders = {
    pieces: path.join(DEMO_TMP_ROOT, "host-pieces"), plugins: path.join(DEMO_TMP_ROOT, "host-plugins"),
    config: path.join(DEMO_TMP_ROOT, "host-config.json"),
  };
  const clientFolders = {
    pieces: path.join(DEMO_TMP_ROOT, "client-pieces"), plugins: path.join(DEMO_TMP_ROOT, "client-plugins"),
    config: path.join(DEMO_TMP_ROOT, "client-config.json"),
  };
  for (const folders of [hostFolders, clientFolders]) {
    fs.mkdirSync(folders.pieces, { recursive: true });
    fs.mkdirSync(folders.plugins, { recursive: true });
  }

  console.log("[demo] opening docker compose in its own terminal");
  runInXterm(
    "docker-compose", "100x18+0+0",
    `cd ${shellQuote(MUGEN_DIR)} && docker compose up -d --wait && touch ${shellQuote(DOCKER_READY_SENTINEL)}`
  );
  await positionXtermWindow("docker-compose", 0, 0);

  console.log("[demo] building match-agent");
  await buildMatchAgent();

  const hostUrl = `http://localhost:${HOST_MATCH_AGENT_PORT}`;
  const clientUrl = `http://localhost:${CLIENT_MATCH_AGENT_PORT}`;
  const matchAgentEntry = path.join(REPO_ROOT, "core/match-agent/dist/index.js");
  // --config-file matters even though every other setting is already passed explicitly below:
  // without it, both instances fall back to the same shared ~/roster-lock/match-agent.json, and
  // `listen` unconditionally (non-atomically) writes to it on every startup - launching host and
  // client's terminals close together races those two writes/reads against each other and can
  // hand one of them back truncated JSON ("Unexpected end of JSON input"), confirmed by hand.
  // Giving each its own file removes the shared state entirely, not just the race.
  const matchAgentCommand = (port: number, folders: { pieces: string, plugins: string, config: string }) => [
    process.execPath, matchAgentEntry, "listen",
    "--port", String(port), "--auth-code", MATCH_AGENT_AUTH_CODE,
    "--piece-folder", folders.pieces, "--plugin-folder", folders.plugins, "--config-file", folders.config,
  ].map(shellQuote).join(" ");

  console.log("[demo] opening both players' match agents in their own terminals");
  runInXterm("match-agent-host", "100x18+0+420", matchAgentCommand(HOST_MATCH_AGENT_PORT, hostFolders));
  runInXterm("match-agent-client", "100x18+0+840", matchAgentCommand(CLIENT_MATCH_AGENT_PORT, clientFolders));
  await Promise.all([
    positionXtermWindow("match-agent-host", 0, 420),
    positionXtermWindow("match-agent-client", 0, 840),
  ]);

  console.log("[demo] waiting for docker compose to report healthy...");
  await waitForSentinelFile(DOCKER_READY_SENTINEL, 5 * 60 * 1000);

  const env = loadEnvVars(ENV_VARS_DIR);
  const titledRoomClientEnv = {
    VITE_AUTH_SERVICE_URL: env.PUBLIC_AUTH_SERVICE_URL,
    VITE_TITLED_ROOM_URL: env.PUBLIC_TITLED_ROOM_URL,
  };

  console.log("[demo] starting vite servers, registering with relay-room, waiting on both match agents");
  const [, , , hostAgent, clientAgent] = await Promise.all([
    startViteServer(processes, "match-agent-client", "@roster-lock/match-agent-client", MATCH_AGENT_CLIENT_PORT),
    startViteServer(
      processes, "titled-room-client", "@roster-lock/titled-room-client", TITLED_ROOM_CLIENT_PORT, titledRoomClientEnv
    ),
    setupServers(),
    // installIkemenViaUI: true for the host only - the client has no equivalent UI prompt on
    // RoomDetailPage (the joining player never sees Create Room's "missing plugin" list), so it
    // still gets ikemen-go installed programmatically like the other infrastructure plugins.
    preparePlayerMatchAgent(
      processes, "host", hostUrl, MATCH_AGENT_AUTH_CODE, IKEMEN_BINARY_LOCATION,
      { windowSize: { width: 960, height: 1040 }, installIkemenViaUI: true },
    ),
    preparePlayerMatchAgent(
      processes, "client", clientUrl, MATCH_AGENT_AUTH_CODE, IKEMEN_BINARY_LOCATION,
      { windowSize: { width: 960, height: 1040 } },
    ),
  ]);

  console.log("[demo] opening + positioning both browser windows");
  // slowMo paces every Playwright action (clicks, fills, selects) with a visible delay - without
  // it the whole titled-room flow below finishes in a couple of seconds, too fast to follow in a
  // recording. Configurable since "slow enough to watch" is a judgment call, not a fixed value.
  const slowMo = Number(process.env.DEMO_SLOW_MO_MS ?? 500);
  const browser = await chromium.launch({ headless: false, slowMo });
  const hostContext = await browser.newContext();
  const clientContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const clientPage = await clientContext.newPage();
  await positionWindow(hostPage, 0, 0, 940, 760);
  await positionWindow(clientPage, 970, 0, 940, 760);

  const rosterConfig = JSON.parse(fs.readFileSync(ROSTER_LOCK_PATH, "utf-8")) as RosterLockV1Config;
  const pickCounts = requiredPickCounts(rosterConfig);

  console.log("[demo] host: connect + login");
  const hostFrame = await connectAndLogin(hostPage, hostAgent, HOST_CREDENTIALS);
  console.log("[demo] host: create room (installing the ikemen-go game launcher plugin through the window)");
  await hostCreateRoom(hostPage, hostFrame, hostAgent.binaryLocation);

  console.log("[demo] client: connect + login");
  const clientFrame = await connectAndLogin(clientPage, clientAgent, CLIENT_CREDENTIALS);
  console.log("[demo] client: join room");
  await clientJoinRoom(clientFrame);

  console.log("[demo] both: make selection");
  // Stage always picks one of the two non-default variants, and host/client always get different
  // ones - "Training Room" (the bare default) never gets voted for at all, so the room's
  // democracy-random tie-break always has exactly Storm vs. Rainbow to pick between.
  const [hostStage, clientStage] = Math.random() < 0.5 ? ["Storm", "Rainbow"] : ["Rainbow", "Storm"];
  await Promise.all([
    makeSelection(hostPage, hostFrame, pickCounts, hostStage),
    makeSelection(clientPage, clientFrame, pickCounts, clientStage),
  ]);

  console.log("[demo] host: start match");
  await hostFrame.getByRole("button", { name: "Start Match" }).click({ timeout: 30_000 });

  console.log("[demo] waiting for download + real Ikemen GO process on both sides");
  await Promise.all([
    waitForGameRunning(hostPage),
    waitForGameRunning(clientPage),
  ]);

  console.log("[demo] positioning both real Ikemen GO windows side by side");
  const [hostWindowId, clientWindowId] = await Promise.all([
    positionIkemenWindow(hostAgent.binaryLocation, 0, 0),
    positionIkemenWindow(clientAgent.binaryLocation, 960, 0),
  ]);

  // Give the VS screen itself a moment to actually render before trying to skip it (the window
  // exists slightly before its content is ready for input).
  await new Promise((resolve) => setTimeout(resolve, 2_000));

  console.log("[demo] skipping Ikemen's VS-screen intro on each window so the round actually starts");
  await skipVersusScreen(hostWindowId);
  await skipVersusScreen(clientWindowId);
  // Let the round-start transition actually finish rendering before testing movement.
  await new Promise((resolve) => setTimeout(resolve, 1_500));

  console.log("[demo] holding an arrow key on each window to show both are live and connected");
  await demoArrowKeyHold(hostWindowId, "Right", 500);
  await demoArrowKeyHold(clientWindowId, "Left", 500);

  console.log("[demo] READY - both Ikemen GO windows should be running now.");
  console.log("[demo] Everything is left running on purpose. Ctrl+C this process to tear down docker compose;");
  console.log("[demo] the docker-compose/match-agent-host/match-agent-client terminal windows are separate processes - close those yourself when done.");

  await new Promise(() => {});
}

main().catch((err) => {
  console.error("[demo] failed:", err);
  process.exit(1);
});
