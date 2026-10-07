import { Page } from "@playwright/test";

const BUTTON_COUNT = 17;

// Matches GlobalNavContext's own DPAD_*/default gamepad bindings
// (core/match-agent/client/src/context/GlobalNavContext.tsx) - kept here
// too since a spec drives the mock gamepad by button index directly,
// rather than through the app's own (rebindable) config.
export const GAMEPAD_BUTTON = {
  select: 0,
  back: 1,
  menu: 9,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
} as const;

declare global {
  interface Window {
    __mockGamepadState?: { buttons: Array<boolean>, axes: [number, number] };
  }
}

// There's no real way to simulate a Gamepad API *connection* from outside
// the browser - neither Playwright nor CDP exposes a gamepad-injection
// protocol. But this app never listens for "gamepadconnected"; both
// GlobalNavContext and useCursorInput just poll navigator.getGamepads()
// every animation frame (see useGamepads.ts's own comment on why), so
// stubbing that one read is enough to drive the whole app with a fully
// scriptable fake controller. Must be called before page.goto() - an
// init script only applies to documents created after it's registered.
export async function installMockGamepad(page: Page): Promise<void> {
  await page.addInitScript((buttonCount: number) => {
    const state: { buttons: Array<boolean>, axes: [number, number] } = {
      buttons: new Array(buttonCount).fill(false),
      axes: [0, 0],
    };
    window.__mockGamepadState = state;

    const fakePad = (): Gamepad => ({
      id: "Mock Gamepad (Playwright)",
      index: 0,
      connected: true,
      timestamp: performance.now(),
      mapping: "standard",
      axes: state.axes,
      buttons: state.buttons.map((pressed) => ({ pressed, touched: pressed, value: pressed ? 1 : 0 })),
    } as unknown as Gamepad);

    navigator.getGamepads = () => [fakePad(), null, null, null] as Array<Gamepad | null>;
  }, BUTTON_COUNT);
}

async function setButton(page: Page, index: number, pressed: boolean): Promise<void> {
  await page.evaluate(({ index, pressed }) => {
    const state = window.__mockGamepadState;
    if (state) state.buttons[index] = pressed;
  }, { index, pressed });
}

// Presses then releases, one frame apart - GlobalNavContext/useCursorInput
// both edge-detect (fire once per press, not once per frame a button reads
// held), so a tap has to actually transition false -> true -> false to
// read as one press rather than being held across every later assertion.
export async function tapGamepadButton(page: Page, index: number): Promise<void> {
  await setButton(page, index, true);
  await page.waitForTimeout(100);
  await setButton(page, index, false);
  await page.waitForTimeout(50);
}
