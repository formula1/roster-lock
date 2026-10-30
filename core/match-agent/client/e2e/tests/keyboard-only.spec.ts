// Every interaction below uses page.keyboard only - no .click()/.fill()
// anywhere in this file. That's the actual thing under test: a player who
// has only a keyboard (no mouse, no gamepad) must be able to reach and
// operate every page this suite covers via GlobalNavContext's Select/Back/
// Menu/Move scheme (core/match-agent/client/src/context/GlobalNavContext.tsx).
import { test, expect } from "@playwright/test";
import { MATCH_AGENT_URL, MATCH_AGENT_AUTH_CODE } from "../lib/env";

async function connect(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  // Waits for the field to actually be there before tabbing to it - a bare
  // Tab immediately after goto() can race the app's first render.
  await expect(page.getByLabel("Match Agent URL")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Match Agent URL")).toBeFocused();
  await page.keyboard.press("Control+A");
  await page.keyboard.type(MATCH_AGENT_URL);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Auth Code")).toBeFocused();
  await page.keyboard.press("Control+A");
  await page.keyboard.type(MATCH_AGENT_AUTH_CODE);
  // Submits the form natively - GlobalNavContext's own Enter handling is
  // skipped while a text field is focused (see isTyping in useCursorInput.ts).
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/match-making$/, { timeout: 15_000 });
}

test("connect, then open the menu and navigate pages - keyboard only", async ({ page }) => {
  await connect(page);

  // Menu (Space) - reaches NavBar's links in one press rather than
  // Tab-ing all the way up to them. NavBar itself renders the same links
  // outside #page-content (see App.tsx), so locators below are scoped to
  // .fullscreen-menu specifically - otherwise "Match Making"/"Controls"
  // would each match two <a> elements.
  await page.keyboard.press("Space");
  const menu = page.locator(".fullscreen-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "Match Making", exact: true })).toBeFocused();

  // Move (arrow keys) - NAV_LINKS order is Match Making, Games, Join
  // Settings, Game Launchers, Preview Roster, Controls, Connect - five
  // presses reaches Controls.
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("link", { name: "Controls", exact: true })).toBeFocused();

  // Select (Enter) - follows the focused link and closes the menu.
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/controls$/);
  await expect(page.getByRole("heading", { name: "Controls" })).toBeVisible();
  await expect(page.locator(".fullscreen-menu")).toBeHidden();

  // Back (Backspace) - browser-back, since neither the menu nor the
  // on-screen keyboard is open.
  await page.keyboard.press("Backspace");
  await expect(page).toHaveURL(/\/match-making$/);
});

// No keyboard equivalent of "a focused <select> doesn't trap Move" below -
// GlobalNavContext's isTyping guard (see useCursorInput.ts) hands off to
// native browser behaviour entirely while a <select> (or any form control)
// is focused, for a physical keyboard: arrow keys natively cycle its value
// without our code running at all, and Tab (never intercepted) always
// escapes it regardless. There's nothing for our own stepSelect/Move
// split to fix on this device - see gamepad-only.spec.ts, where a
// controller has no Tab-equivalent fallback and the same scenario was a
// real focus trap before that split existed.
