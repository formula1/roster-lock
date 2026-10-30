// Every interaction below goes through installMockGamepad/tapGamepadButton
// - no .click()/.fill()/page.keyboard anywhere in this file. This is the
// other half of "no mouse, keyboard or gamepad only": a mocked gamepad is
// the sole input device driving the whole test (see ../lib/mockGamepad.ts
// for why/how navigator.getGamepads() can be stubbed at all).
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, Page } from "@playwright/test";
import { installPlugin, PluginManager } from "@roster-lock/plugin-runtime";
import { installMockGamepad, tapGamepadButton, GAMEPAD_BUTTON } from "../lib/mockGamepad";
import { typeViaOnscreenKeyboard } from "../lib/onscreenKeyboard";
import { selectFileDialogEntry } from "../lib/fileDialog";
import {
  MATCH_AGENT_URL, MATCH_AGENT_AUTH_CODE, MATCH_AGENT_SETTINGS_STORAGE_KEY, ROSTER_LOCK_FOLDER, PLUGIN_FOLDER,
} from "../lib/env";

// Seeds MatchAgentContext's own localStorage settings before the app's
// first script runs, so ConnectPage's autoSubmit effect connects on its
// own. Typing a URL/auth code via a gamepad is exactly what the second
// test in this file proves separately (through the on-screen keyboard) -
// re-proving it here would just make this test about something else.
async function seedConnectedSettings(page: Page): Promise<void> {
  await page.addInitScript(
    ({ key, url, authCode }: { key: string, url: string, authCode: string }) => {
      localStorage.setItem(key, JSON.stringify({ url, authCode }));
    },
    { key: MATCH_AGENT_SETTINGS_STORAGE_KEY, url: MATCH_AGENT_URL, authCode: MATCH_AGENT_AUTH_CODE }
  );
}

test("navigate pages using only a mocked gamepad", async ({ page }) => {
  await installMockGamepad(page);
  await seedConnectedSettings(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/match-making$/, { timeout: 15_000 });

  // Menu (Start) - reaches NavBar's links in one press. NavBar itself
  // renders the same links outside #page-content (see App.tsx), so
  // locators below are scoped to .fullscreen-menu specifically - otherwise
  // "Match Making"/"Controls"/"Join Settings" would each match two <a>
  // elements.
  await tapGamepadButton(page, GAMEPAD_BUTTON.menu);
  const menu = page.locator(".fullscreen-menu");
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "Match Making", exact: true })).toBeFocused();

  // Move (d-pad down) - NAV_LINKS order is Match Making, Games, Join
  // Settings, Game Launchers, Preview Roster, Controls, Connect - five
  // presses reaches Controls, same as the keyboard spec's ArrowDown sequence.
  for (let i = 0; i < 5; i++) await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
  await expect(menu.getByRole("link", { name: "Controls", exact: true })).toBeFocused();

  // Select (A)
  await tapGamepadButton(page, GAMEPAD_BUTTON.select);
  await expect(page).toHaveURL(/\/controls$/);
  await expect(page.getByRole("heading", { name: "Controls" })).toBeVisible();

  // Back (B) - browser-back, since neither the menu nor the on-screen
  // keyboard is open.
  await tapGamepadButton(page, GAMEPAD_BUTTON.back);
  await expect(page).toHaveURL(/\/match-making$/);
});

test("confirming a text field with the gamepad opens the on-screen keyboard, which can type into it", async ({ page }) => {
  await installMockGamepad(page);
  await seedConnectedSettings(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/match-making$/, { timeout: 15_000 });

  await tapGamepadButton(page, GAMEPAD_BUTTON.menu);
  const menu = page.locator(".fullscreen-menu");
  await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
  await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
  await expect(menu.getByRole("link", { name: "Join Settings", exact: true })).toBeFocused();
  await tapGamepadButton(page, GAMEPAD_BUTTON.select);
  await expect(page).toHaveURL(/\/join-settings$/);

  const labelInput = page.locator(".player-slot-row input").first();
  await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
  await expect(labelInput).toBeFocused();

  // Select on a focused text field opens the on-screen keyboard instead of
  // clicking it - a controller has no other way to type.
  await tapGamepadButton(page, GAMEPAD_BUTTON.select);
  await expect(page.locator(".onscreen-keyboard")).toBeVisible();

  await typeViaOnscreenKeyboard(page, "hi");
  await expect(labelInput).toHaveValue(/hi$/);

  // Back closes the on-screen keyboard rather than navigating away.
  await tapGamepadButton(page, GAMEPAD_BUTTON.back);
  await expect(page.locator(".onscreen-keyboard")).toBeHidden();
});

test("a focused <select> doesn't trap Move - gamepad only", async ({ page }) => {
  await installMockGamepad(page);
  await seedConnectedSettings(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/match-making$/, { timeout: 15_000 });

  await tapGamepadButton(page, GAMEPAD_BUTTON.menu);
  const menu = page.locator(".fullscreen-menu");
  await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
  await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
  await expect(menu.getByRole("link", { name: "Join Settings", exact: true })).toBeFocused();
  await tapGamepadButton(page, GAMEPAD_BUTTON.select);
  await expect(page).toHaveURL(/\/join-settings$/);

  // First Move press lands on the first focusable control (nothing was
  // focused after navigating) - the default single slot's own label input.
  await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
  await expect(page.locator(".player-slot-row input").first()).toBeFocused();

  // Second press reaches the input-device <select>. A gamepad has no
  // Tab-equivalent fallback the way a keyboard does (see
  // keyboard-only.spec.ts's comment on why this scenario doesn't need a
  // keyboard version at all) - before GlobalNavContext split Move into
  // up/down (always move) vs left/right (adjust a focused select, else
  // also move), a further d-pad-down here would forward into stepSelect
  // and - since this select has only one option ("Keyboard") before any
  // gamepad is assigned as a player's own input source - silently do
  // nothing, permanently trapping focus on it.
  await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
  await expect(page.locator(".player-slot-row select").first()).toBeFocused();

  // Third press must move *past* the select - this is the actual
  // regression check. The default slot's own Remove button is disabled
  // (only one slot exists) and so isn't part of the focusable list at all,
  // so this lands on "Add local player" instead.
  await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
  await expect(page.getByRole("button", { name: "Add local player" })).toBeFocused();
});

test("picks a file through the on-screen file dialog using only a mocked gamepad", async ({ page }) => {
  // The dialog lists match-agent's own host filesystem, bounded to its
  // configured rosterLockFolder (see util-routers/file-system/
  // resolve-within-root.ts) - a real fixture folder/file inside that exact
  // folder, not a native dialog's own canned state, is what proves
  // navigating it with the gamepad actually works. Placed via a nested
  // folder (rather than typed in via the on-screen keyboard) because
  // typing a long path one on-screen keypress at a time is slow enough to
  // risk the test's own timeout - navigating two short folder hops by
  // d-pad is both faster and closer to this dialog's actual point.
  const folderName = "roster-lock-e2e-filedialog-fixture";
  const folder = join(ROSTER_LOCK_FOLDER, folderName);
  const fixturePath = join(folder, "fixture.roster-lock.json");
  await mkdir(folder, { recursive: true });
  await writeFile(fixturePath, JSON.stringify({ version: 1, engine: { name: "x" }, rosters: {} }));

  try {
    await installMockGamepad(page);
    await seedConnectedSettings(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/match-making$/, { timeout: 15_000 });

    await tapGamepadButton(page, GAMEPAD_BUTTON.menu);
    const menu = page.locator(".fullscreen-menu");
    // NAV_LINKS order is Match Making, Games, Join Settings, Game
    // Launchers, Preview Roster, Controls, Connect - four presses reaches
    // Preview Roster.
    for (let i = 0; i < 4; i++) await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
    await expect(menu.getByRole("link", { name: "Preview Roster", exact: true })).toBeFocused();
    await tapGamepadButton(page, GAMEPAD_BUTTON.select);
    await expect(page).toHaveURL(/\/preview-roster$/);

    // Two Move presses: first lands on the (empty) path input, second on
    // "Browse..." - confirming it opens the dialog instead of a native OS
    // one, which a gamepad could never reach at all.
    await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
    await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
    await expect(page.getByRole("button", { name: "Browse..." })).toBeFocused();
    await tapGamepadButton(page, GAMEPAD_BUTTON.select);
    const dialog = page.locator(".onscreen-file-dialog");
    await expect(dialog).toBeVisible();

    // The path input was left empty, so the dialog opened at match-agent's
    // own host home directory - navigate into the fixture folder, then
    // pick the fixture file, by accessible name rather than any assumed
    // position (a real home directory's own other contents are outside
    // this test's control).
    await selectFileDialogEntry(page, `${folderName}/`);
    const pathInput = page.locator('input[placeholder="Path to a .roster-lock.json file"]');
    await expect(dialog.getByRole("button", { name: "fixture.roster-lock.json", exact: true })).toBeVisible();
    await selectFileDialogEntry(page, "fixture.roster-lock.json");

    await expect(dialog).toBeHidden();
    await expect(pathInput).toHaveValue(fixturePath);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

// The only test in this suite that installs a real plugin - everything
// else deliberately avoids plugins/Docker/real binaries (see
// playwright.config.ts's own comment on why). Removing a downloaded
// binary needs a real, loadable GameLauncherPlugin to list in the first
// place, so this is the one exception. Kept to this file only (not
// duplicated into keyboard-only.spec.ts): it's the sole test anywhere in
// this suite that mutates the shared match-agent instance's game-launcher
// settings/binaries for one plugin, and fullyParallel:true means another
// copy of this same test running concurrently in a second file would race
// it over that same shared state.
const HEADLESS_PLUGIN_NAME = "@roster-lock/game-launcher-headless";
const HEADLESS_PLUGIN_DIR = join(
  fileURLToPath(new URL(".", import.meta.url)), "../../../../../plugins/game-launcher/headless"
);

test("removes a downloaded binary through the game-launcher settings page using only a mocked gamepad", async ({ page }) => {
  // Installed straight onto match-agent's own already-running plugin
  // folder (plugin-management's readManifest re-reads plugins.json fresh
  // per request - no restart needed, see PLUGIN_FOLDER's own comment in
  // ../lib/env.ts) - headless chosen because it needs no real binary and
  // its getLocalVersion always succeeds, so listBinaries has something
  // real to report once a folder exists under its dataDir below.
  await installPlugin(PLUGIN_FOLDER, HEADLESS_PLUGIN_DIR);

  // Stands in for what getBinary would have produced for a plugin that
  // actually implements it (headless doesn't) - same trick as
  // core/match-agent/tests/integration/game-launcher-binaries.test.ts's
  // identically-purposed regression test. Stored *relative* to
  // PLUGIN_FOLDER deliberately, matching what a real download would
  // persist (see relativizeBinaryLocation) rather than an absolute path.
  const relativeBinaryLocation = join("data", HEADLESS_PLUGIN_NAME, "binaries", "v1");
  await mkdir(join(PLUGIN_FOLDER, relativeBinaryLocation), { recursive: true });
  const pluginManager = await PluginManager.create(PLUGIN_FOLDER);
  await pluginManager.gameLauncher.setLocalSettings(HEADLESS_PLUGIN_NAME, { binaryLocation: relativeBinaryLocation });

  try {
    await installMockGamepad(page);
    await seedConnectedSettings(page);
    await page.goto("/");
    await expect(page).toHaveURL(/\/match-making$/, { timeout: 15_000 });

    await tapGamepadButton(page, GAMEPAD_BUTTON.menu);
    const menu = page.locator(".fullscreen-menu");
    // NAV_LINKS order is Match Making, Games, Join Settings, Game
    // Launchers, Preview Roster, Controls, Connect - three presses
    // reaches Game Launchers.
    for (let i = 0; i < 3; i++) await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
    await expect(menu.getByRole("link", { name: "Game Launchers", exact: true })).toBeFocused();
    await tapGamepadButton(page, GAMEPAD_BUTTON.select);
    await expect(page).toHaveURL(/\/game-launcher$/);

    // One Move press reaches the list's only link (this plugin is the
    // only one ever installed into PLUGIN_FOLDER across the whole suite).
    await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
    const launcherLink = page.getByRole("link", { name: "Headless (Test Fixture)" });
    await expect(launcherLink).toBeFocused();
    await tapGamepadButton(page, GAMEPAD_BUTTON.select);
    await expect(page).toHaveURL(`/game-launcher/${encodeURIComponent(HEADLESS_PLUGIN_NAME)}`);

    // Wait for both async loads (GameLauncherSettingsForm's own load() and
    // loadBinaries()) to settle before counting Move presses below -
    // otherwise "Check version" may still be disabled (no binaryLocation
    // yet) and the binaries <ul> may not have rendered, both of which
    // would shift the focusable list's order.
    await expect(page.getByLabel("Binary location")).toHaveValue(relativeBinaryLocation);
    const binariesList = page.locator(".game-launcher-binaries-list");
    await expect(binariesList.locator("li")).toHaveCount(1);

    // Six Move presses: Binary location input, Browse..., Save, Check
    // version, Download / update, then this one downloaded binary's own
    // Remove button.
    for (let i = 0; i < 6; i++) await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
    await expect(binariesList.getByRole("button", { name: "Remove" })).toBeFocused();

    await tapGamepadButton(page, GAMEPAD_BUTTON.select);
    await expect(binariesList).toBeHidden();
  } finally {
    await rm(join(PLUGIN_FOLDER, relativeBinaryLocation), { recursive: true, force: true });
    await pluginManager.gameLauncher.setLocalSettings(HEADLESS_PLUGIN_NAME, {});
  }
});
