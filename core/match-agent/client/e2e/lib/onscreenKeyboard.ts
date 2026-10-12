import { Page } from "@playwright/test";
import { tapGamepadButton, GAMEPAD_BUTTON } from "./mockGamepad";

// Drives the on-screen keyboard (core/match-agent/client/src/components/
// OnScreenKeyboard.tsx) the same way a real gamepad-only player would:
// d-pad right to move to the next key, A ("select") to press whichever
// one is focused. Doesn't assume ROWS' layout/order - looks each
// character's own button up by its text content and steps forward from
// wherever focus actually is, so it stays correct if that layout changes.
export async function typeViaOnscreenKeyboard(page: Page, text: string): Promise<void> {
  const keys = page.locator(".onscreen-keyboard button");
  const count = await keys.count();

  for (const char of text) {
    const label = char === " " ? "Space" : char;
    let targetIndex = -1;
    for (let i = 0; i < count; i++) {
      const content = (await keys.nth(i).textContent())?.trim();
      if (content === label) {
        targetIndex = i;
        break;
      }
    }
    if (targetIndex === -1) throw new Error(`No on-screen-keyboard key found for ${JSON.stringify(char)}`);

    const currentIndex = await keys.evaluateAll((buttons) => buttons.findIndex((b) => b === document.activeElement));
    const from = currentIndex === -1 ? 0 : currentIndex;
    const steps = (targetIndex - from + count) % count;
    for (let i = 0; i < steps; i++) await tapGamepadButton(page, GAMEPAD_BUTTON.dpadRight);
    await tapGamepadButton(page, GAMEPAD_BUTTON.select);
  }
}
