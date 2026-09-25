import { useEffect, useState } from "react";

export type ConnectedGamepad = { index: number, id: string };

// Polls navigator.getGamepads() rather than relying solely on
// gamepadconnected/gamepaddisconnected events - Chrome only fires those
// after a button press on some platforms, and polling is what
// useCursorInput needs anyway to read stick/button state every frame.
export function useGamepads(): Array<ConnectedGamepad> {
  const [gamepads, setGamepads] = useState<Array<ConnectedGamepad>>([]);

  useEffect(() => {
    let frame: number;
    const poll = () => {
      const pads = navigator.getGamepads?.() ?? [];
      const connected: Array<ConnectedGamepad> = [];
      for (const pad of pads) {
        if (pad) connected.push({ index: pad.index, id: pad.id });
      }
      setGamepads((prev) => {
        if (prev.length === connected.length && prev.every((p, i) => p.index === connected[i].index)) return prev;
        return connected;
      });
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, []);

  return gamepads;
}
