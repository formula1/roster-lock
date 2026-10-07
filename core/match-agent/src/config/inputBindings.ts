import { join as pathJoin, dirname } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { z, ZodType } from "zod";

export type NavAction = "select" | "back" | "menu";
export type KeyboardBindings = Record<NavAction, string>;
export type GamepadBindings = Record<NavAction, number>;
export type InputBindings = { keyboard: KeyboardBindings, gamepad: GamepadBindings };

export const DEFAULT_INPUT_BINDINGS: InputBindings = {
  keyboard: { select: "Enter", back: "Backspace", menu: " " },
  gamepad: { select: 0, back: 1, menu: 9 },
};

function actionMap<T extends ZodType>(value: T) {
  return z.object({ select: value, back: value, menu: value }).strict();
}

export const inputBindingsSchema: ZodType<InputBindings> = z.object({
  keyboard: actionMap(z.string().min(1)),
  gamepad: actionMap(z.number().int().min(0)),
}).strict();

// Stored as its own file rather than a field on MatchAgentConfig
// (match-agent.json, see ../config/manage.ts): rebindable keys/buttons are
// a match-agent-client UI concern, not part of the auth-code/folder
// settings that file's schema is scoped to. It's still a *sibling* of that
// file though - same directory - so it resolves through the exact same
// portable-root discovery (see findConfigFile): next to the match-agent
// executable when that's a mounted USB, the per-user home directory
// otherwise. This is what lets rebound controls follow a player's USB
// from one arcade/cafe machine to the next instead of living in whatever
// browser profile happened to be open on the host (see
// docs/economics/machine-environments/pieces-usb.md/cafe.md).
export function inputBindingsFilePath(configFilePath: string): string {
  return pathJoin(dirname(configFilePath), "input-bindings.json");
}

export async function getInputBindings(configFilePath: string): Promise<InputBindings> {
  try {
    const contents = await readFile(inputBindingsFilePath(configFilePath), "utf8");
    const parsed = inputBindingsSchema.safeParse(JSON.parse(contents));
    if (parsed.success) return parsed.data;
  } catch {
    // No file yet (first run / fresh USB) or it's unreadable - either way,
    // defaults are the right answer rather than surfacing an error for
    // something that just means "never rebound".
  }
  return DEFAULT_INPUT_BINDINGS;
}

export async function setInputBindings(configFilePath: string, bindings: InputBindings): Promise<void> {
  const filePath = inputBindingsFilePath(configFilePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(bindings, null, 2) + "\n");
}
