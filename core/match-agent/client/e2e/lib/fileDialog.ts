import { Page } from "@playwright/test";
import { tapGamepadButton, GAMEPAD_BUTTON } from "./mockGamepad";

// Drives the on-screen file dialog (components/OnScreenFileDialog.tsx) the
// way a real gamepad-only player would: d-pad down to move to the next
// row, A to "press" the focused one (opening a folder or picking a file).
// Doesn't assume how many rows exist or what order they're in - unlike the
// on-screen keyboard's fixed layout, this is a real filesystem's own
// contents - so it looks the target row up by its accessible name and
// steps forward from wherever focus actually is, same approach as
// ./onscreenKeyboard.ts's typeViaOnscreenKeyboard.
export async function selectFileDialogEntry(page: Page, name: string): Promise<void> {
  const rows = page.locator(".onscreen-file-dialog button");
  const count = await rows.count();

  let targetIndex = -1;
  for (let i = 0; i < count; i++) {
    const text = (await rows.nth(i).textContent())?.trim();
    if (text === name) {
      targetIndex = i;
      break;
    }
  }
  if (targetIndex === -1) throw new Error(`No file-dialog row found for ${JSON.stringify(name)}`);

  const currentIndex = await rows.evaluateAll((buttons) => buttons.findIndex((b) => b === document.activeElement));
  const from = currentIndex === -1 ? 0 : currentIndex;
  const steps = (targetIndex - from + count) % count;
  for (let i = 0; i < steps; i++) await tapGamepadButton(page, GAMEPAD_BUTTON.dpadDown);
  await tapGamepadButton(page, GAMEPAD_BUTTON.select);
}
