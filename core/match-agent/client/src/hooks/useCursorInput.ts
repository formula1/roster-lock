import { useEffect, useRef } from "react";
import { InputSource } from "../context/JoinSettingsContext";

const AXIS_THRESHOLD = 0.5;
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;
const CONFIRM_BUTTON = 0;

type Held = { left: boolean, right: boolean, up: boolean, down: boolean, confirm: boolean };
const NONE_HELD: Held = { left: false, right: false, up: false, down: false, confirm: false };

// A keyboard slot's listener is on window, so it would otherwise fire while
// the player is typing in the roster filter box - where Space and Enter mean
// "type a space"/"submit", not "pick the cursored piece".
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

// Drives one player slot's cursor over a grid of cards: arrow keys for a
// keyboard-assigned slot, d-pad/left-stick + button 0 for a gamepad-assigned
// one. Column moves (left/right) and row moves (up/down) are reported
// separately because only the caller knows how many columns its grid
// currently resolves to - see useGridColumns. Edge-detected (fires once per
// press, not once per frame) so a held direction doesn't spam the callbacks.
// Plain mouse clicks on a card work regardless of this hook - it's an
// addition on top of that, not a replacement for it (see components/Selection).
export function useCursorInput({ source, enabled, onMoveColumn, onMoveRow, onConfirm }: {
  source: InputSource,
  enabled: boolean,
  onMoveColumn: (delta: number) => void,
  onMoveRow: (delta: number) => void,
  onConfirm: () => void,
}) {
  // Held through a ref so the two effects below depend only on the input
  // source, not on callback identity: the caller's onConfirm closes over the
  // current cursor position and so is a new function every render, and
  // re-running the gamepad effect that often would tear down and restart its
  // requestAnimationFrame loop (losing the edge-detection state with it).
  const handlersRef = useRef({ onMoveColumn, onMoveRow, onConfirm });
  useEffect(() => { handlersRef.current = { onMoveColumn, onMoveRow, onConfirm }; });

  const heldRef = useRef<Held>(NONE_HELD);

  useEffect(() => {
    if (!enabled || source.type !== "keyboard") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const { onMoveColumn, onMoveRow, onConfirm } = handlersRef.current;
      if (e.key === "ArrowLeft") onMoveColumn(-1);
      else if (e.key === "ArrowRight") onMoveColumn(1);
      else if (e.key === "ArrowUp") onMoveRow(-1);
      else if (e.key === "ArrowDown") onMoveRow(1);
      else if (e.key === "Enter" || e.key === " ") onConfirm();
      else return;
      // Arrow keys and Space scroll the page by default, which fights the
      // grid's own scroll-the-cursor-into-view.
      e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, source]);

  useEffect(() => {
    if (!enabled || source.type !== "gamepad") return;
    let frame: number;
    const poll = () => {
      const pad = navigator.getGamepads?.()[source.index];
      if (pad) {
        const horizontal = pad.axes[0] ?? 0;
        const vertical = pad.axes[1] ?? 0;
        const next: Held = {
          left: horizontal < -AXIS_THRESHOLD || Boolean(pad.buttons[DPAD_LEFT]?.pressed),
          right: horizontal > AXIS_THRESHOLD || Boolean(pad.buttons[DPAD_RIGHT]?.pressed),
          up: vertical < -AXIS_THRESHOLD || Boolean(pad.buttons[DPAD_UP]?.pressed),
          down: vertical > AXIS_THRESHOLD || Boolean(pad.buttons[DPAD_DOWN]?.pressed),
          confirm: Boolean(pad.buttons[CONFIRM_BUTTON]?.pressed),
        };

        const handlers = handlersRef.current;
        if (next.left && !heldRef.current.left) handlers.onMoveColumn(-1);
        if (next.right && !heldRef.current.right) handlers.onMoveColumn(1);
        if (next.up && !heldRef.current.up) handlers.onMoveRow(-1);
        if (next.down && !heldRef.current.down) handlers.onMoveRow(1);
        if (next.confirm && !heldRef.current.confirm) handlers.onConfirm();

        heldRef.current = next;
      }
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, [enabled, source]);
}
