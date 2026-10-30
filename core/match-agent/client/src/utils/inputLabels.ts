// Standard-mapping index -> the label printed on a typical Xbox-layout
// gamepad, since that's what GlobalNavContext's defaults (and most USB
// controllers reporting the browser's "standard" mapping) line up with.
const GAMEPAD_BUTTON_NAMES: Record<number, string> = {
  0: "A", 1: "B", 2: "X", 3: "Y", 4: "LB", 5: "RB", 6: "LT", 7: "RT",
  8: "Select", 9: "Start", 10: "LS", 11: "RS",
  12: "D-pad Up", 13: "D-pad Down", 14: "D-pad Left", 15: "D-pad Right",
};

export function gamepadButtonLabel(index: number): string {
  return GAMEPAD_BUTTON_NAMES[index] ?? `Button ${index}`;
}

export function keyLabel(key: string): string {
  if (key === " ") return "Space";
  return key.length === 1 ? key.toUpperCase() : key;
}

export function backHint(
  inputDevice: "keyboard" | "gamepad",
  keyboardBindings: { back: string },
  gamepadBindings: { back: number },
): string {
  return inputDevice === "gamepad" ? gamepadButtonLabel(gamepadBindings.back) : keyLabel(keyboardBindings.back);
}
