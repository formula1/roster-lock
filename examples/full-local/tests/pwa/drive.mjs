import { chromium } from "playwright-core";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");

const PWA_URL = process.env.PWA_URL ?? "http://localhost:4173/";
const AUTH_CODE = process.env.MATCH_AGENT_AUTH ?? "abc123";
const DISPLAY_NAME = process.env.DISPLAY_NAME ?? "Player-PWA";
const CHROME_PATH = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";
const ROSTER_LOCK_PATH = process.env.ROSTER_LOCK_PATH
  ?? path.join(REPO_ROOT, "examples/full-local/simple-game.roster-lock.json");

const SHOT_DIR = path.join(__dirname, "shots");

/**
 * Drives the game-pwa example through a full match against whatever
 * opponent is already waiting in the matchmaking queue (usually a
 * game-headless instance - see examples/full-local/CLAUDE.md / the
 * integration package's `server-setup` + `run-game` scripts).
 *
 * Usage: pnpm run drive
 * Env vars (all optional, defaults match the full-local example):
 *   PWA_URL, MATCH_AGENT_AUTH, DISPLAY_NAME, CHROME_PATH, ROSTER_LOCK_PATH
 */

let shotN = 0;
async function shot(page, name) {
  shotN += 1;
  const shotPath = path.join(SHOT_DIR, `${String(shotN).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: shotPath });
  console.log(`screenshot: ${shotPath}`);
}

async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`[console.error] ${msg.text()}`);
  });
  page.on("pageerror", (err) => console.log(`[pageerror] ${err}`));

  try {
    await page.goto(PWA_URL, { waitUntil: "domcontentloaded" });
    // Connect auto-validates any saved auth code first ("Checking saved
    // connection..."); a fresh browser profile has none, so it falls through
    // to the auth-code prompt. Match agent / matchmaker / game coordinator
    // URLs default to this stack's docker-compose ports (see
    // DEFAULT_MATCH_AGENT_CONNECTION), so only auth code + name are needed
    // here - /settings is only for overriding those defaults.
    await page.waitForSelector("text=Connect to Match Agent", { timeout: 15000 });
    await shot(page, "connect");

    await page.fill("#authCode", AUTH_CODE);
    await page.fill("#displayName", DISPLAY_NAME);
    await page.click('button:has-text("Connect")');

    await page.waitForSelector("text=Load Roster Config", { timeout: 15000 });
    await shot(page, "roster-upload");

    await page.setInputFiles("#roster-file", ROSTER_LOCK_PATH);
    await page.waitForSelector("text=Loaded", { timeout: 10000 });
    await shot(page, "roster-loaded");
    await page.click('button:has-text("Continue")');

    await page.waitForSelector("text=Choose Your Pieces", { timeout: 15000 });
    await shot(page, "select-screen");

    const sections = await page.$$(".piece-type-section");
    for (const section of sections) {
      const heading = await section.$eval("h3", (el) => el.textContent ?? "");
      const exact = heading.match(/pick exactly (\d+)/);
      const range = heading.match(/pick (\d+)-/);
      const needed = exact ? parseInt(exact[1], 10) : range ? parseInt(range[1], 10) : 0;
      const cards = await section.$$(".piece-card");
      console.log(`section "${heading.trim()}": need ${needed}, ${cards.length} cards available`);
      for (let i = 0; i < needed && i < cards.length; i++) {
        await cards[i].click();
        await page.waitForTimeout(300);
      }
    }
    await shot(page, "select-filled");

    const confirmBtn = page.locator('button:has-text("Confirm Selection")');
    await confirmBtn.waitFor({ state: "attached", timeout: 5000 });
    if (await confirmBtn.isDisabled()) {
      throw new Error("Confirm Selection button still disabled after picking pieces");
    }
    await confirmBtn.click();

    await page.waitForSelector("text=Matchmaking", { timeout: 15000 });
    await shot(page, "matchmaking");

    await page.waitForSelector("text=Downloading Pieces", { timeout: 60000 });
    await shot(page, "download-start");
    console.log("Matched with opponent, download started.");

    await page.waitForURL("**/game", { timeout: 120000 });
    await shot(page, "game-start");
    console.log("Download complete, entered game screen.");

    await page.waitForSelector("text=Turn 1", { timeout: 30000 });
    await shot(page, "game-turn1");

    const deadline = Date.now() + 5 * 60 * 1000;
    let turnsSubmitted = 0;
    while (Date.now() < deadline) {
      const url = page.url();
      if (!url.includes("/game")) {
        console.log(`Left /game screen (now at ${url}) - game loop ended.`);
        break;
      }
      const submitBtn = page.locator('button:has-text("Submit Moves")');
      if ((await submitBtn.count()) > 0 && !(await submitBtn.isDisabled())) {
        await submitBtn.click();
        turnsSubmitted += 1;
        console.log(`Submitted moves (turn ${turnsSubmitted}).`);
        await shot(page, `after-submit-${turnsSubmitted}`);
      }
      const banner = page.locator(".banner");
      if ((await banner.count()) > 0) {
        console.log(`Banner/error visible: ${await banner.first().textContent()}`);
      }
      await page.waitForTimeout(1000);
    }

    await shot(page, "final");
    console.log(`Done. Final URL: ${page.url()}`);
  } catch (err) {
    console.error("DRIVER FAILED:", err);
    await shot(page, "error");
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
