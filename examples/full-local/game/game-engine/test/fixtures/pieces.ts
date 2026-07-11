import path from "node:path";

import { Character, GaugeType } from "../../src/types/character";
import { RunnableMove } from "../../src/types/move";
import { WeatherType } from "../../src/types/stage";
import { loadPieceModule, loadPieceStats } from "../../src/game/assets/loadPieceFile";
import { nodeGetFileContents } from "./nodeGetFileContents";

// examples/full-local/game/game-engine/test/fixtures -> examples/full-local/pieces
const PIECES_DIR = path.resolve(__dirname, "../../../../pieces");
const HP_SCALE = 10;

type CharacterStatsPiece = {
  id: string,
  name: string,
  color: string,
  stats: { hp: number, attack: number, speed: number },
};

type MovePieceData = {
  id: string,
  name: string,
  damage: number,
  weather?: { type: string, turns: number } | null,
};

export async function loadCharacterStats(pieceId: string): Promise<CharacterStatsPiece> {
  return loadPieceStats(nodeGetFileContents, path.join(PIECES_DIR, "character", pieceId), "stats.json5");
}

export async function loadMoveData(pieceId: string): Promise<MovePieceData> {
  return (
    await loadPieceModule(nodeGetFileContents, path.join(PIECES_DIR, "move", pieceId), "logic.js")
  ).moveData;
}

export async function loadStageInitialWeather(
  pieceId: string
): Promise<{ type: WeatherType, turnsLeft: number }> {
  const stage = await loadPieceModule(nodeGetFileContents, path.join(PIECES_DIR, "stage", pieceId), "logic.js");
  const { weather } = (stage.onLoad as () => { weather: { type: WeatherType, turnsLeft: number } })();
  return weather;
}

export function movePieceToRunnable(moveData: MovePieceData): RunnableMove {
  const effects: RunnableMove = {
    damage: {
      type: "gauge-subtract",
      stat: GaugeType.Hp,
      value: moveData.damage,
      target: { type: "explicit", targets: 1 },
    },
  };
  if(moveData.weather){
    effects.weather = {
      type: "weather",
      value: { type: "fixed", value: moveData.weather.type as WeatherType },
      turns: moveData.weather.turns,
    };
  }
  return effects;
}

export async function makeCharacter(
  piecesId: string, characterId: string, ownerPlayer: string, moveIds: Array<string>
): Promise<Character> {
  const { stats } = await loadCharacterStats(piecesId);
  const moves = await Promise.all(moveIds.map(async (moveId) => (
    [moveId, movePieceToRunnable(await loadMoveData(moveId))] as const
  )));
  return {
    id: characterId,
    ownerPlayer,
    controllerPlayer: ownerPlayer,
    [GaugeType.Hp]: { current: stats.hp * HP_SCALE, max: stats.hp * HP_SCALE },
    [GaugeType.Stamina]: { current: 10, max: 10 },
    speed: stats.speed,
    attack: stats.attack,
    moves: Object.fromEntries(moves),
  };
}
