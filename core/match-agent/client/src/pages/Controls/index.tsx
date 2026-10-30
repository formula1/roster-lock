import { useEffect, useState } from "react";
import { NavAction, useGlobalNav } from "../../context/GlobalNavContext";
import { gamepadButtonLabel, keyLabel } from "../../utils/inputLabels";

const ACTIONS: Array<{ action: NavAction, label: string }> = [
  { action: "select", label: "Select" },
  { action: "back", label: "Back" },
  { action: "menu", label: "Menu" },
];

type Capture = { device: "keyboard" | "gamepad", action: NavAction };

// Lets a player rebind the three single-press actions GlobalNavContext
// drives the shell with (Move stays fixed to arrow keys/d-pad+stick - it's
// a pair of directions, not a single press to capture). While capturing,
// global nav is suspended so the very key/button being captured doesn't
// also fire as that action with its *old* binding.
export function ControlsPage() {
  const {
    keyboardBindings, gamepadBindings, setKeyboardBinding, setGamepadBinding, resetBindings, setNavSuspended,
  } = useGlobalNav();
  const [capture, setCapture] = useState<Capture | null>(null);

  useEffect(() => {
    if (!capture) return;
    setNavSuspended(true);

    const cancel = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCapture(null);
    };
    window.addEventListener("keydown", cancel);

    if (capture.device === "keyboard") {
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") return;
        e.preventDefault();
        setKeyboardBinding(capture.action, e.key);
        setCapture(null);
      };
      window.addEventListener("keydown", onKeyDown);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keydown", cancel);
        setNavSuspended(false);
      };
    }

    // A button might still read as physically pressed on the very first
    // poll - e.g. the gamepad confirm button, if that's what the player
    // used to click into this capture in the first place. Such a button is
    // only accepted once it's been seen released and pressed again, so
    // rebinding an action to its own current button still requires an
    // actual new press rather than just reusing the one already in flight.
    let frame: number;
    let baseline: Set<number> | null = null;
    const releasedSinceStart = new Set<number>();
    const poll = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const pressedNow = new Set<number>();
      for (const pad of pads) {
        if (!pad) continue;
        pad.buttons.forEach((button, index) => { if (button.pressed) pressedNow.add(index); });
      }
      if (baseline === null) baseline = new Set(pressedNow);
      for (let i = 0; i < 32; i++) {
        if (!pressedNow.has(i)) releasedSinceStart.add(i);
      }
      for (const index of pressedNow) {
        if (!baseline.has(index) || releasedSinceStart.has(index)) {
          setGamepadBinding(capture.action, index);
          setCapture(null);
          return;
        }
      }
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", cancel);
      setNavSuspended(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture]);

  return (
    <div className="page">
      <h1>Controls</h1>
      <p>
        Select a button below, then press the key or gamepad button you want for that action. Press Escape to
        cancel.
      </p>
      <table className="controls-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Keyboard</th>
            <th>Gamepad</th>
          </tr>
        </thead>
        <tbody>
          {ACTIONS.map(({ action, label }) => (
            <tr key={action}>
              <td>{label}</td>
              <td>
                <button type="button" onClick={() => setCapture({ device: "keyboard", action })}>
                  {capture?.device === "keyboard" && capture.action === action
                    ? "Press a key..."
                    : keyLabel(keyboardBindings[action])}
                </button>
              </td>
              <td>
                <button type="button" onClick={() => setCapture({ device: "gamepad", action })}>
                  {capture?.device === "gamepad" && capture.action === action
                    ? "Press a button..."
                    : gamepadButtonLabel(gamepadBindings[action])}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={resetBindings}>Reset to defaults</button>
    </div>
  );
}
