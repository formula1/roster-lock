import { RefObject } from "react";
import { useGlobalNav } from "../context/GlobalNavContext";
import { backHint } from "../utils/inputLabels";

// Punctuation matters here specifically because this app's own text
// fields need it - a matchmaker URL ("http://localhost:58732") or a saved
// IP address is unusable without ":", "/", and ".", and without this row a
// gamepad-only player (no physical keyboard to fall back to) would have no
// way to type one at all.
const ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
  [".", ":", "/", "-", "_"],
];

// The standard trick for writing into a React-controlled input from outside
// React: assigning el.value directly is intercepted by React's own tracked
// setter, so the native setter has to be called explicitly before the
// "input" event is dispatched for React to pick the change up.
function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// Shown whenever a gamepad confirms a text field (see GlobalNavContext) -
// a controller has no other way to type into it. Only appends/removes at
// the end of the field rather than supporting mid-string cursor placement;
// for the short fields this is used on (player labels, a matchmaker URL)
// clearing and retyping is an acceptable trade-off against the complexity
// of gamepad-driven cursor placement.
export function OnScreenKeyboard({ containerRef, target, onClose }: {
  containerRef: RefObject<HTMLDivElement | null>,
  target: HTMLInputElement | HTMLTextAreaElement | null,
  onClose: () => void,
}) {
  const { inputDevice, keyboardBindings, gamepadBindings } = useGlobalNav();
  if (!target) return null;

  // Deliberately doesn't re-focus `target` afterwards: setNativeValue
  // doesn't need it focused, and doing so would yank document.activeElement
  // off whichever OSK button was just pressed - the next Move press (see
  // GlobalNavContext) would then lose its place and reset to the start of
  // the keyboard instead of continuing from a key that's probably still
  // nearby.
  const press = (key: string) => {
    if (key === "back") setNativeValue(target, target.value.slice(0, -1));
    else if (key === "space") setNativeValue(target, `${target.value} `);
    else setNativeValue(target, `${target.value}${key}`);
  };

  return (
    <div className="onscreen-keyboard-backdrop">
      <div className="onscreen-keyboard" ref={containerRef}>
        {ROWS.map((row, i) => (
          <div key={i} className="onscreen-keyboard-row">
            {row.map((key) => (
              <button key={key} type="button" onClick={() => press(key)}>{key}</button>
            ))}
          </div>
        ))}
        <div className="onscreen-keyboard-row">
          <button type="button" className="onscreen-keyboard-space" onClick={() => press("space")}>Space</button>
          <button type="button" onClick={() => press("back")}>Back</button>
          <button type="button" className="onscreen-keyboard-done" onClick={onClose}>
            Done ({backHint(inputDevice, keyboardBindings, gamepadBindings)})
          </button>
        </div>
      </div>
    </div>
  );
}
