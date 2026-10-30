import { useGlobalNav } from "../context/GlobalNavContext";
import { gamepadButtonLabel, keyLabel } from "../utils/inputLabels";

// A persistent reminder of the four-action scheme GlobalNavContext drives
// the whole shell with, swapping key labels for button labels (and
// reflecting whatever the player has rebound on the Controls page)
// depending on whichever device was used most recently - so a player who
// just picked up a controller isn't stuck remembering a keyboard-labelled
// hint, and vice versa.
export function InputHints() {
  const { inputDevice, keyboardBindings, gamepadBindings } = useGlobalNav();

  const items = inputDevice === "gamepad"
    ? [
      { action: "Select", key: gamepadButtonLabel(gamepadBindings.select) },
      { action: "Back", key: gamepadButtonLabel(gamepadBindings.back) },
      { action: "Menu", key: gamepadButtonLabel(gamepadBindings.menu) },
      { action: "Move", key: "D-pad" },
    ]
    : [
      { action: "Select", key: keyLabel(keyboardBindings.select) },
      { action: "Back", key: keyLabel(keyboardBindings.back) },
      { action: "Menu", key: keyLabel(keyboardBindings.menu) },
      { action: "Move", key: "Arrow keys" },
    ];

  return (
    <div className="input-hints">
      {items.map((hint) => (
        <span key={hint.action} className="input-hint">
          <span className="input-hint-key">{hint.key}</span>
          {hint.action}
        </span>
      ))}
    </div>
  );
}
