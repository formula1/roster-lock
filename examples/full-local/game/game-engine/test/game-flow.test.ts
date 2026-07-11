import { describe, it, expect } from "vitest";

import { createRandom } from "../src/utils/Random";
import { prepareTurn } from "../src/game/prepare-turn";
import { runTurn } from "../src/game/run-turn";
import { GameState, MoveDescription } from "../src/types";
import { WeatherType } from "../src/types/stage";
import { loadStageInitialWeather, makeCharacter } from "./fixtures/pieces";

const MAX_TURNS = 50;

describe("full game using examples/full-local/pieces", () => {
  it("plays a full match against real piece content to a decisive winner", async () => {
    const random = createRandom();
    random.seed({ test: "game-engine-game-flow-test" });

    const characterMoves: Record<string, Array<string>> = {
      "p1-blue": ["basic", "rain"],
      "p1-red": ["strong", "weak"],
      "p2-yellow": ["basic", "snow"],
      "p2-blue": ["basic", "rain"],
    };

    const gameState: GameState = {
      turnCount: 0,
      winners: null,
      stage: { weather: await loadStageInitialWeather("beach") },
      players: { p1: { id: "p1" }, p2: { id: "p2" } },
      characters: {
        "p1-blue": await makeCharacter("blue", "p1-blue", "p1", characterMoves["p1-blue"]),
        "p1-red": await makeCharacter("red", "p1-red", "p1", characterMoves["p1-red"]),
        "p2-yellow": await makeCharacter("yellow", "p2-yellow", "p2", characterMoves["p2-yellow"]),
        "p2-blue": await makeCharacter("blue", "p2-blue", "p2", characterMoves["p2-blue"]),
      },
    };

    expect(gameState.stage.weather.type).toBe(WeatherType.Sun);

    let weatherEverChanged = false;
    let turns = 0;
    while(!gameState.winners && turns < MAX_TURNS){
      const rawMoves = buildTurnMoves(gameState, characterMoves);
      const turnState = prepareTurn(gameState, rawMoves, random);
      for(const _point of runTurn(gameState, turnState, random)){
        if(gameState.stage.weather.type !== WeatherType.Sun) weatherEverChanged = true;
      }
      gameState.turnCount++;
      turns++;
    }

    expect(turns).toBeLessThan(MAX_TURNS);
    expect(gameState.winners).not.toBeNull();
    expect(gameState.winners!.length).toBeGreaterThan(0);
    expect(weatherEverChanged).toBe(true);
  });
});

function buildTurnMoves(
  gameState: GameState,
  characterMoves: Record<string, Array<string>>
): Record<string, Array<Omit<MoveDescription, "player">>> {
  const movesByPlayer: Record<string, Array<Omit<MoveDescription, "player">>> = {};

  for(const character of Object.values(gameState.characters)){
    if(character.hp.current <= 0) continue;
    const enemy = Object.values(gameState.characters).find(
      (other) => other.ownerPlayer !== character.ownerPlayer && other.hp.current > 0
    );
    if(!enemy) continue;

    const moveIds = characterMoves[character.id]!;
    const moveId = moveIds[gameState.turnCount % moveIds.length]!;
    const runnableMove = character.moves[moveId]!;

    const config: Record<string, any> = {};
    for(const [key, effect] of Object.entries(runnableMove)){
      config[key] = (effect.type === "gauge-subtract" || effect.type === "gauge-add")
        ? { targets: [enemy.id] }
        : {};
    }

    const list = movesByPlayer[character.controllerPlayer] ?? (movesByPlayer[character.controllerPlayer] = []);
    list.push({ characterId: character.id, move: { id: moveId, config } });
  }

  return movesByPlayer;
}
