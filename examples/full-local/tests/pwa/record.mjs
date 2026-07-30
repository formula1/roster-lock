import { chromium } from "playwright-core";
import { execFileSync } from "child_process";
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

const VIDEO_DIR = path.join(__dirname, "videos");
const OUTPUT_PATH = path.join(VIDEO_DIR, "game-pwa-playthrough.mp4");
const VIEWPORT = { width: 1280, height: 800 };

/**
 * Same flow as drive.mjs, but records a video of the browser instead of
 * screenshotting each step - for watching the pwa play out end to end
 * rather than asserting on it. Requires ffmpeg on PATH to convert the raw
 * webm capture to mp4.
 *
 * Usage: pnpm run record
 * Env vars: same as drive.mjs (PWA_URL, MATCH_AGENT_AUTH, DISPLAY_NAME,
 * CHROME_PATH, ROSTER_LOCK_PATH)
 */

async function main() {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: VIDEO_DIR, size: VIEWPORT },
  });
  const page = await context.newPage();
  page.on("pageerror", (err) => console.log(`[pageerror] ${err}`));

  try {
    await page.goto(PWA_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("text=Connect to Match Agent", { timeout: 15000 });
    await page.waitForTimeout(800);

    await page.fill("#authCode", AUTH_CODE);
    await page.fill("#displayName", DISPLAY_NAME);
    await page.waitForTimeout(500);
    await page.click('button:has-text("Connect")');

    await page.waitForSelector("text=Load Roster Config", { timeout: 15000 });
    await page.waitForTimeout(500);
    await page.setInputFiles("#roster-file", ROSTER_LOCK_PATH);
    await page.waitForSelector("text=Loaded", { timeout: 10000 });
    await page.waitForTimeout(800);
    await page.click('button:has-text("Continue")');

    await page.waitForSelector("text=Choose Your Pieces", { timeout: 15000 });
    await page.waitForTimeout(500);

    const sections = await page.$$(".piece-type-section");
    for (const section of sections) {
      const heading = await section.$eval("h3", (el) => el.textContent ?? "");
      const exact = heading.match(/pick exactly (\d+)/);
      const range = heading.match(/pick (\d+)-/);
      const needed = exact ? parseInt(exact[1], 10) : range ? parseInt(range[1], 10) : 0;
      const cards = await section.$$(".piece-card");
      console.log(`section "${heading.trim()}": picking ${needed} of ${cards.length}`);
      for (let i = 0; i < needed && i < cards.length; i++) {
        await cards[i].scrollIntoViewIfNeeded();
        await cards[i].click();
        await page.waitForTimeout(500);
      }
    }
    await page.waitForTimeout(800);

    const confirmBtn = page.locator('button:has-text("Confirm Selection")');
    await confirmBtn.waitFor({ state: "attached", timeout: 5000 });
    await confirmBtn.scrollIntoViewIfNeeded();
    await confirmBtn.click();

    await page.waitForSelector("text=Matchmaking", { timeout: 15000 });
    console.log("Waiting for matchmaking...");

    await page.waitForSelector("text=Downloading Pieces", { timeout: 60000 });
    console.log("Matched, downloading...");

    await page.waitForURL("**/game", { timeout: 120000 });
    console.log("In game.");

    await page.waitForSelector("text=Turn 1", { timeout: 30000 });
    await page.waitForTimeout(800);

    const deadline = Date.now() + 5 * 60 * 1000;
    let turnsSubmitted = 0;
    while (Date.now() < deadline) {
      const url = page.url();
      if (!url.includes("/game")) {
        console.log(`Game over (now at ${url}).`);
        break;
      }
      const submitBtn = page.locator('button:has-text("Submit Moves")');
      if ((await submitBtn.count()) > 0 && !(await submitBtn.isDisabled())) {
        await submitBtn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
        await submitBtn.click();
        turnsSubmitted += 1;
        console.log(`Submitted moves (turn ${turnsSubmitted}).`);
      }
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(1500);
    console.log(`Done. Final URL: ${page.url()}`);
  } catch (err) {
    console.error("RECORDING FAILED:", err);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }

  const rawVideoPath = await page.video()?.path();
  if (!rawVideoPath || !fs.existsSync(rawVideoPath)) {
    throw new Error("No video was recorded.");
  }

  console.log(`Converting ${rawVideoPath} -> ${OUTPUT_PATH} ...`);
  execFileSync("ffmpeg", ["-y", "-i", rawVideoPath, "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUTPUT_PATH]);
  fs.rmSync(rawVideoPath, { force: true });
  console.log(`Video ready: ${OUTPUT_PATH}`);
}

main();
