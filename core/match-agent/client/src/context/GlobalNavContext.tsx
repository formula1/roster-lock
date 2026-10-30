import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { isTyping } from "../hooks/useCursorInput";
import { useMatchAgent } from "./MatchAgentContext";
import {
  NavAction, KeyboardBindings, GamepadBindings, InputBindings,
  getInputBindings, setInputBindings as putInputBindings,
} from "../api/matchAgent";
import { FullScreenMenu } from "../components/FullScreenMenu";
import { OnScreenKeyboard } from "../components/OnScreenKeyboard";
import { OnScreenFileDialog } from "../components/OnScreenFileDialog";
import { InputHints } from "../components/InputHints";

export type { NavAction, KeyboardBindings, GamepadBindings };
export type InputDevice = "keyboard" | "gamepad";

export type FileDialogOptions = {
  // Defaults to match-agent's own host home directory when omitted.
  startPath?: string,
  // e.g. ".roster-lock.json" - filters which files show up without hiding
  // any folders, so navigation is never blocked.
  extension?: string,
  // Shown in the dialog's own footer, e.g. "roster-lock files".
  extensionLabel?: string,
};
export type FileDialogState = FileDialogOptions & { resolve: (path: string | null) => void };

// Move (arrow keys / d-pad+stick) isn't offered for rebinding - it's a
// pair of directions rather than a single press, and every other axis- or
// d-pad-shaped control a user might want to use for it already reports
// through the same two inputs.
export const DEFAULT_KEYBOARD_BINDINGS: KeyboardBindings = { select: "Enter", back: "Backspace", menu: " " };
export const DEFAULT_GAMEPAD_BINDINGS: GamepadBindings = { select: 0, back: 1, menu: 9 };
const DEFAULT_BINDINGS: InputBindings = { keyboard: DEFAULT_KEYBOARD_BINDINGS, gamepad: DEFAULT_GAMEPAD_BINDINGS };

const AXIS_THRESHOLD = 0.5;
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;

type Held = { up: boolean, down: boolean, left: boolean, right: boolean, confirm: boolean, back: boolean, menu: boolean };
const NONE_HELD: Held = {
  up: false, down: false, left: false, right: false, confirm: false, back: false, menu: false,
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const TEXT_ENTRY_TYPES = ["text", "search", "password", "email", "url", "tel", "number"];

function isTextEntry(el: Element): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && TEXT_ENTRY_TYPES.includes(el.type);
}

// A rebound action key might be a letter, whose KeyboardEvent.key differs
// by case depending on whether Shift is held ("r" vs "R") - the binding
// itself is stored without that distinction, so a single-character match
// is case-insensitive while multi-character keys ("Enter", "Backspace")
// still match exactly.
function matchesKey(key: string, binding: string): boolean {
  if (key.length === 1 && binding.length === 1) return key.toLowerCase() === binding.toLowerCase();
  return key === binding;
}

function focusableIn(container: HTMLElement | null): Array<HTMLElement> {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

function moveFocus(container: HTMLElement | null, delta: number) {
  const items = focusableIn(container);
  if (items.length === 0) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  const nextIndex = index === -1 ? (delta > 0 ? 0 : items.length - 1) : (index + delta + items.length) % items.length;
  items[nextIndex].focus();
}

// A <select>'s own focused-native-arrow-key behaviour (cycle its options)
// is what a keyboard user already gets for free from the browser - a
// controller has no such thing, so Left/Right repurpose the press to step
// the select's value instead of moving page focus when one is focused
// (Up/Down always move page focus instead, specifically so a select can
// never trap Move entirely - see GlobalNavProvider's up/down vs left/right
// split below).
function stepSelect(select: HTMLSelectElement, delta: number) {
  const nextIndex = select.selectedIndex + delta;
  if (nextIndex < 0 || nextIndex >= select.options.length) return;
  select.selectedIndex = nextIndex;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

type GlobalNavContextValue = {
  inputDevice: InputDevice,
  keyboardBindings: KeyboardBindings,
  gamepadBindings: GamepadBindings,
  setKeyboardBinding: (action: NavAction, key: string) => void,
  setGamepadBinding: (action: NavAction, buttonIndex: number) => void,
  resetBindings: () => void,
  // Opens OnScreenFileDialog and resolves with the picked absolute path,
  // or null if cancelled - a DOM-rendered alternative to a native OS file
  // dialog (see pick-file.ts/api/matchAgent's pickRosterLockFile), which a
  // gamepad has no way to reach at all since it's a window outside the
  // browser entirely. Promise-based so a caller can just `await` it like
  // it would a native picker.
  pickFile: (options?: FileDialogOptions) => Promise<string | null>,
  // Lets a component with its own gamepad/keyboard-driven interaction (the
  // piece selection grid - see useCursorInput; the Controls page's own
  // rebind capture) take exclusive control of input while it's mounted, so
  // the same press isn't also read as menu navigation.
  setNavSuspended: (suspended: boolean) => void,
};

const GlobalNavContext = createContext<GlobalNavContextValue | null>(null);

export function useGlobalNav(): GlobalNavContextValue {
  const ctx = useContext(GlobalNavContext);
  if (!ctx) throw new Error("useGlobalNav must be used within a GlobalNavProvider");
  return ctx;
}

// Makes the whole shell navigable by keyboard or gamepad through one
// shared scheme of four actions, each with its own on-screen hint (see
// InputHints) that swaps to match whichever device was used most recently,
// and each (bar Move) rebindable from the Controls page:
//   Select - Enter / A        - clicks the focused control, or - for a
//            text field, which a controller has no other way to type into
//            - opens the on-screen keyboard
//   Back   - Backspace / B    - closes the menu/keyboard, else goes back a page
//   Menu   - Space / Start    - the full-screen menu, so a controller can
//            reach NavBar's links without roving-focusing all the way up
//   Move   - Arrow keys / d-pad+stick - steps focus among the current
//            page's own controls (see #page-content in App.tsx)
// This intentionally does NOT layer on top of native Tab - Space's default
// (scroll the page / activate a focused button) is reassigned to Menu, so
// every focused control is reached and activated through this scheme on
// both devices alike, rather than keyboard getting one set of behaviours
// and gamepad another. The selection grid (useCursorInput) keeps its own
// separate Enter/Space-to-pick scheme, since it's per-player-slot and
// already shipped before this existed.
export function GlobalNavProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { settings } = useMatchAgent();
  const [menuOpen, setMenuOpen] = useState(false);
  const [oskTarget, setOskTarget] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [fileDialog, setFileDialog] = useState<FileDialogState | null>(null);
  const [inputDevice, setInputDevice] = useState<InputDevice>("keyboard");
  const [bindings, setBindings] = useState<InputBindings>(DEFAULT_BINDINGS);
  const menuRef = useRef<HTMLDivElement>(null);
  const oskRef = useRef<HTMLDivElement>(null);
  const fileDialogRef = useRef<HTMLDivElement>(null);
  const suspendedRef = useRef(false);
  const heldRef = useRef<Held>(NONE_HELD);

  // Fetched from match-agent (not localStorage) so rebound controls live
  // on whatever USB/install the player is actually using, not the browser
  // profile of whichever host happens to be running it - see
  // core/match-agent/src/config/inputBindings.ts.
  useEffect(() => {
    let cancelled = false;
    getInputBindings(settings.url, settings.authCode)
      .then((loaded) => { if (!cancelled) setBindings(loaded); })
      .catch((e) => console.error("Failed to load input bindings from match-agent", e));
    return () => { cancelled = true; };
  }, [settings.url, settings.authCode]);

  const persistBindings = (next: InputBindings) => {
    setBindings(next);
    putInputBindings(settings.url, settings.authCode, next)
      .catch((e) => console.error("Failed to save input bindings to match-agent", e));
  };

  const activeContainer = (): HTMLElement | null => {
    if (fileDialog) return fileDialogRef.current;
    if (oskTarget) return oskRef.current;
    if (menuOpen) return menuRef.current;
    return document.getElementById("page-content");
  };

  // Up/Down always move focus - a focused <select> never captures them, so
  // Move can always step past one. Left/Right adjust a focused select's
  // value instead (see stepSelect), falling back to moving focus for every
  // other control, same as before.
  const moveFocusOnly = (delta: number) => moveFocus(activeContainer(), delta);
  const adjustOrMoveFocus = (delta: number) => {
    const activeEl = document.activeElement;
    if (activeEl instanceof HTMLSelectElement) stepSelect(activeEl, delta);
    else moveFocus(activeContainer(), delta);
  };

  const confirmActive = () => {
    const activeEl = document.activeElement;
    if (!(activeEl instanceof HTMLElement)) return;
    if (isTextEntry(activeEl)) setOskTarget(activeEl);
    else activeEl.click();
  };

  const toggleMenu = () => {
    setOskTarget(null);
    setMenuOpen((open) => !open);
  };

  const goBack = () => {
    if (fileDialog) fileDialog.resolve(null);
    else if (oskTarget) setOskTarget(null);
    else if (menuOpen) setMenuOpen(false);
    else navigate(-1);
  };

  const pickFile = (options: FileDialogOptions = {}): Promise<string | null> => new Promise((resolvePromise) => {
    setMenuOpen(false);
    setOskTarget(null);
    setFileDialog({
      ...options,
      resolve: (path) => { setFileDialog(null); resolvePromise(path); },
    });
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (suspendedRef.current) return;
      setInputDevice("keyboard");
      if (isTyping(e.target)) return;
      if (matchesKey(e.key, bindings.keyboard.select)) {
        e.preventDefault();
        confirmActive();
      } else if (matchesKey(e.key, bindings.keyboard.back)) {
        e.preventDefault();
        goBack();
      } else if (matchesKey(e.key, bindings.keyboard.menu)) {
        e.preventDefault();
        toggleMenu();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        moveFocusOnly(-1);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        moveFocusOnly(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        adjustOrMoveFocus(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        adjustOrMoveFocus(1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oskTarget, menuOpen, fileDialog, bindings]);

  useEffect(() => {
    let frame: number;
    const poll = () => {
      frame = requestAnimationFrame(poll);
      if (suspendedRef.current) {
        heldRef.current = NONE_HELD;
        return;
      }

      const pads = navigator.getGamepads?.() ?? [];
      let next: Held = NONE_HELD;
      for (const pad of pads) {
        if (!pad) continue;
        const horizontal = pad.axes[0] ?? 0;
        const vertical = pad.axes[1] ?? 0;
        next = {
          up: next.up || vertical < -AXIS_THRESHOLD || Boolean(pad.buttons[DPAD_UP]?.pressed),
          down: next.down || vertical > AXIS_THRESHOLD || Boolean(pad.buttons[DPAD_DOWN]?.pressed),
          left: next.left || horizontal < -AXIS_THRESHOLD || Boolean(pad.buttons[DPAD_LEFT]?.pressed),
          right: next.right || horizontal > AXIS_THRESHOLD || Boolean(pad.buttons[DPAD_RIGHT]?.pressed),
          confirm: next.confirm || Boolean(pad.buttons[bindings.gamepad.select]?.pressed),
          back: next.back || Boolean(pad.buttons[bindings.gamepad.back]?.pressed),
          menu: next.menu || Boolean(pad.buttons[bindings.gamepad.menu]?.pressed),
        };
      }

      const held = heldRef.current;
      const anyEdge = (next.up && !held.up) || (next.down && !held.down) || (next.left && !held.left)
        || (next.right && !held.right) || (next.confirm && !held.confirm) || (next.back && !held.back)
        || (next.menu && !held.menu);
      if (anyEdge) setInputDevice("gamepad");

      if (next.menu && !held.menu) {
        toggleMenu();
      } else {
        if (next.up && !held.up) moveFocusOnly(-1);
        if (next.down && !held.down) moveFocusOnly(1);
        if (next.left && !held.left) adjustOrMoveFocus(-1);
        if (next.right && !held.right) adjustOrMoveFocus(1);
        if (next.confirm && !held.confirm) confirmActive();
        if (next.back && !held.back) goBack();
      }
      heldRef.current = next;
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen, oskTarget, fileDialog, bindings]);

  // Opening the menu, the keyboard, or the file dialog should land focus
  // inside it immediately, so the very next move-press has something to
  // move from. (Re-focusing the first row after navigating *within* an
  // already-open file dialog is OnScreenFileDialog's own job, since the
  // current folder's listing lives in its state, not here.)
  useEffect(() => {
    if (menuOpen) focusableIn(menuRef.current)[0]?.focus();
  }, [menuOpen]);
  useEffect(() => {
    if (oskTarget) focusableIn(oskRef.current)[0]?.focus();
  }, [oskTarget]);
  useEffect(() => {
    if (fileDialog) focusableIn(fileDialogRef.current)[0]?.focus();
  }, [fileDialog]);

  const value = useMemo<GlobalNavContextValue>(() => ({
    inputDevice,
    keyboardBindings: bindings.keyboard,
    gamepadBindings: bindings.gamepad,
    setKeyboardBinding: (action, key) => persistBindings({ ...bindings, keyboard: { ...bindings.keyboard, [action]: key } }),
    setGamepadBinding: (action, buttonIndex) => persistBindings({
      ...bindings, gamepad: { ...bindings.gamepad, [action]: buttonIndex },
    }),
    resetBindings: () => persistBindings({ keyboard: { ...DEFAULT_KEYBOARD_BINDINGS }, gamepad: { ...DEFAULT_GAMEPAD_BINDINGS } }),
    pickFile,
    setNavSuspended: (suspended: boolean) => { suspendedRef.current = suspended; },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [inputDevice, bindings]);

  return (
    <GlobalNavContext.Provider value={value}>
      {children}
      <FullScreenMenu containerRef={menuRef} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <OnScreenKeyboard containerRef={oskRef} target={oskTarget} onClose={() => setOskTarget(null)} />
      <OnScreenFileDialog containerRef={fileDialogRef} state={fileDialog} />
      <InputHints />
    </GlobalNavContext.Provider>
  );
}
