import { useEffect, useRef } from "react";
import { InputSource } from "../context/JoinSettingsContext";

const AXIS_THRESHOLD = 0.5;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;
const CONFIRM_BUTTON = 0;

// Drives one player slot's cursor over a grid of `itemCount` cards: arrow
// keys for a keyboard-assigned slot, d-pad/left-stick + button 0 for a
// gamepad-assigned one. Edge-detected (fires once per press, not once per
// frame) so a held direction doesn't spam onMove. Plain mouse clicks on a
// card work regardless of this hook - it's an addition on top of that, not
// a replacement for it (see components/Selection).
export function useCursorInput(
  source: InputSource, enabled: boolean, onMove: (delta: number) => void, onConfirm: () => void
) {
  const heldRef = useRef<{ left: boolean, right: boolean, confirm: boolean }>({
    left: false, right: false, confirm: false,
  });

  useEffect(() => {
    if (!enabled || source.type !== "keyboard") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onMove(-1);
      else if (e.key === "ArrowRight") onMove(1);
      else if (e.key === "Enter" || e.key === " ") onConfirm();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, source, onMove, onConfirm]);

  useEffect(() => {
    if (!enabled || source.type !== "gamepad") return;
    let frame: number;
    const poll = () => {
      const pad = navigator.getGamepads?.()[source.index];
      if (pad) {
        const axis = pad.axes[0] ?? 0;
        const left = axis < -AXIS_THRESHOLD || Boolean(pad.buttons[DPAD_LEFT]?.pressed);
        const right = axis > AXIS_THRESHOLD || Boolean(pad.buttons[DPAD_RIGHT]?.pressed);
        const confirm = Boolean(pad.buttons[CONFIRM_BUTTON]?.pressed);

        if (left && !heldRef.current.left) onMove(-1);
        if (right && !heldRef.current.right) onMove(1);
        if (confirm && !heldRef.current.confirm) onConfirm();

        heldRef.current = { left, right, confirm };
      }
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, [enabled, source, onMove, onConfirm]);
}
