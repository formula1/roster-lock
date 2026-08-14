
import { AddGameBody } from "../schema";

export type GameEntry = AddGameBody & { registeredAt: number };

// In-memory, matching this example's other services (examples/full-local's
// matchmaking keeps its queue in memory too) - a real deployment would swap
// this for durable storage without touching the route handlers below.
const games = new Map<string, GameEntry>();

export function getGame(engineSha: string): GameEntry | undefined {
  return games.get(engineSha);
}

export function listGames(): Array<GameEntry> {
  return Array.from(games.values());
}

export function addGame(body: AddGameBody): GameEntry {
  if(games.has(body.engineSha)){
    throw new Error(`A game is already registered for engineSha "${body.engineSha}"`);
  }
  const entry: GameEntry = { ...body, registeredAt: Date.now() };
  games.set(body.engineSha, entry);
  return entry;
}

export function removeGame(engineSha: string): boolean {
  return games.delete(engineSha);
}

// Cheap existence check via the public registry API - this only confirms the
// package name/version is publishable, not that it's actually a valid
// game-runner plugin (that was already validated locally by whichever admin
// installed it to derive gameConfigSchema in the first place).
export async function packageExistsOnNpm(packageName: string, version: string): Promise<boolean> {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`);
  return response.ok;
}
