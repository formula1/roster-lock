// TEMPORARY - interactive visual check only, not part of the real suite.
// Single-player cut-down of mugen.spec.ts: connect, create a room, open
// Make Selection, screenshot the SelectionBoard, then hold the page open so
// a human can look at the real match-agent-client UI themselves. No second
// player, no ready-up/start-match/download/launch - this never needs a real
// Ikemen GO binary (IKEMEN_BINARY_LOCATION just needs to point at *some*
// existing file for copyIkemenInstall's cp -r to succeed).
import * as fs from "fs";
import { test, expect } from "@playwright/test";
import { RosterLockV1Config } from "@roster-lock/types";
import { ProcessGroup } from "../../integration/src/lib/process-utils";
import { dockerComposeUp, dockerComposeDown, setupServers } from "../../integration/src/setupServers";
import { ROSTER_LOCK_PATH } from "../../integration/src/constants";
import { requiredPickCounts } from "../src/lib/roster";
import { buildMatchAgent, startPlayerMatchAgent } from "../src/lib/matchAgentProcess";
import { startViteServer, MATCH_AGENT_CLIENT_PORT } from "../src/lib/viteServers";

const IKEMEN_BINARY_LOCATION = process.env.IKEMEN_BINARY_LOCATION;
const MATCH_AGENT_PORT = 58820;
const MATCH_AGENT_AUTH_CODE = "mugen-view-selection-abc123";
const ROOM_TITLE = `Icon Preview ${Date.now()}`;
const MATCH_AGENT_CLIENT_URL = `http://localhost:${MATCH_AGENT_CLIENT_PORT}`;

const rosterConfig = JSON.parse(fs.readFileSync(ROSTER_LOCK_PATH, "utf-8")) as RosterLockV1Config;
const pickCounts = requiredPickCounts(rosterConfig);

test("view the selection board's portraits in the real match-agent-client UI", async ({ browser }) => {
  test.setTimeout(20 * 60 * 1000);

  if (!IKEMEN_BINARY_LOCATION) throw new Error("IKEMEN_BINARY_LOCATION is not set");

  const processes = new ProcessGroup();
  processes.registerCleanupOnSignals(dockerComposeDown);

  await dockerComposeUp();
  await buildMatchAgent();

  const [, , agent] = await Promise.all([
    startViteServer(processes, "match-agent-client", "@roster-lock/match-agent-client", MATCH_AGENT_CLIENT_PORT),
    setupServers(),
    startPlayerMatchAgent(processes, "solo", MATCH_AGENT_PORT, MATCH_AGENT_AUTH_CODE, IKEMEN_BINARY_LOCATION),
  ]);

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(MATCH_AGENT_CLIENT_URL);
  await expect(page).toHaveURL(/\/connect$/);
  await page.getByLabel("Match Agent URL").fill(agent.url);
  await page.getByLabel("Auth Code").fill(agent.authCode);
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText("Connected.", { exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/join-settings$/);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/match-making$/);
  await page.getByRole("button", { name: "Connect", exact: true }).click();

  const frame = page.frameLocator('iframe[title="Matchmaker"]');
  await frame.getByTestId("account-tab-register").click();
  await frame.getByLabel("Username").fill(`solo-${Date.now()}`);
  await frame.getByLabel("Password").fill("Password1");
  await frame.getByTestId("account-submit-register").click();
  await frame.getByTestId("account-continue").click({ timeout: 20_000 });
  await expect(frame.getByRole("heading", { name: "Rooms" })).toBeVisible({ timeout: 15_000 });

  await frame.getByRole("button", { name: "Create Room" }).click();
  await expect(frame.getByRole("heading", { name: "Create Room" })).toBeVisible();
  await frame.getByLabel("Title").fill(ROOM_TITLE);
  await frame.locator('input[type="file"]').setInputFiles(ROSTER_LOCK_PATH);
  await frame.getByRole("button", { name: "Create Room" }).click();
  await expect(frame.getByRole("heading", { name: ROOM_TITLE })).toBeVisible({ timeout: 15_000 });

  await frame.getByRole("button", { name: "Make Selection" }).click();
  const board = page.locator(".selection-board");
  await expect(board).toBeVisible({ timeout: 15_000 });

  await page.screenshot({ path: "/tmp/claude-1000/-home-sam-Programming-games-match-lock/2f853665-696d-47ef-b99d-e1137724015a/scratchpad/selection-board.png" });

  // Click one card per pickable piece type too, then screenshot the
  // "selected" state (portrait still visible, card highlighted).
  for (const [pieceType, count] of Object.entries(pickCounts)) {
    const section = board.locator(".piece-type-section")
      .filter({ has: page.locator(".piece-type-name", { hasText: new RegExp(`^${pieceType}$`) }) });
    const cards = section.locator(".piece-card");
    for (let i = 0; i < count; i++) await cards.nth(i).click();
  }
  await page.screenshot({ path: "/tmp/claude-1000/-home-sam-Programming-games-match-lock/2f853665-696d-47ef-b99d-e1137724015a/scratchpad/selection-board-picked.png" });

  console.log(`\n>>> match-agent-client is live at ${MATCH_AGENT_CLIENT_URL} - browser window left open.\n`);

  // Hold the page open for interactive inspection - config's 20-minute test
  // timeout (see playwright.config.ts) is the eventual auto-cleanup here.
  await new Promise(() => {});
});
