import { describe, it, expect } from "vitest";

import { Game } from "../src/index";
import { Room } from "../src/room";
import { createSimpleEmitter, ISimpleEventEmitter } from "../src/utils/SimpleEvent";
import { MoveDescription } from "../src/types";
import {
  buildSelectionResult, characterIdsBySpec, moveSetsWeather, CharacterSpec,
} from "./fixtures/rosterLockResult";
import { nodeGetFileContents } from "./fixtures/nodeGetFileContents";

const CHARACTER_SPECS: Array<CharacterSpec> = [
  { userId: "p1", pieceId: "blue", moveIds: ["basic", "rain"] },
  { userId: "p1", pieceId: "red", moveIds: ["strong", "weak"] },
  { userId: "p2", pieceId: "yellow", moveIds: ["basic", "snow"] },
  { userId: "p2", pieceId: "red", moveIds: ["weak", "strong"] },
];
const CHARACTER_MOVES = characterIdsBySpec(CHARACTER_SPECS);

function createLocalMesh(userIds: Array<string>): Record<string, Room> {
  const emitters: Record<string, ISimpleEventEmitter<[string, string, any]>> = {};
  for(const userId of userIds) emitters[userId] = createSimpleEmitter();
  const rooms: Record<string, Room> = {};
  for(const userId of userIds){
    rooms[userId] = {
      userIds,
      onAction: emitters[userId]!,
      broadcastAction(actionType, body){
        for(const otherId of userIds) emitters[otherId]!.emit(userId, actionType, body);
      },
    };
  }
  return rooms;
}

async function buildMovesForTurn(
  game: Game, ownerPlayer: string
): Promise<Array<Omit<MoveDescription, "player">>> {
  const { characters, turnCount } = game.gameState;
  const moves: Array<Omit<MoveDescription, "player">> = [];
  for(const character of Object.values(characters)){
    if(character.controllerPlayer !== ownerPlayer) continue;
    if(character.hp.current <= 0) continue;
    const enemy = Object.values(characters).find(
      (other) => other.ownerPlayer !== ownerPlayer && other.hp.current > 0
    );
    if(!enemy) continue;

    const moveIds = CHARACTER_MOVES[character.id]!;
    const moveId = moveIds[turnCount % moveIds.length]!;

    const config: Record<string, any> = { damage: { targets: [enemy.id] } };
    if(await moveSetsWeather(moveId)) config.weather = {};

    moves.push({ characterId: character.id, move: { id: moveId, config } });
  }
  return moves;
}

describe("Game class end-to-end over a simulated two-player room", () => {
  it("runs both players' Game instances, through real commit-reveal, to the same decisive outcome", async () => {
    const rooms = createLocalMesh(["p1", "p2"]);
    const selectionResult = buildSelectionResult(CHARACTER_SPECS, "beach");

    let gameP1: Game;
    let gameP2: Game;
    [gameP1, gameP2] = await Promise.all([
      Game.create(rooms.p1!, selectionResult, () => buildMovesForTurn(gameP1, "p1"), nodeGetFileContents),
      Game.create(rooms.p2!, selectionResult, () => buildMovesForTurn(gameP2, "p2"), nodeGetFileContents),
    ]);

    const [winnersP1, winnersP2] = await Promise.all([gameP1.gameLoop(), gameP2.gameLoop()]);

    expect(winnersP1.length).toBeGreaterThan(0);
    // Both clients only ever exchange moves (encrypted commit-reveal) and a shared random
    // seed — they should independently converge on the exact same resulting state.
    expect(winnersP1).toEqual(winnersP2);
    expect(gameP1.gameState.turnCount).toEqual(gameP2.gameState.turnCount);
    expect(gameP1.gameState.stage.weather).toEqual(gameP2.gameState.stage.weather);
    expect(
      Object.fromEntries(Object.entries(gameP1.gameState.characters).map(([id, c]) => [id, c.hp]))
    ).toEqual(
      Object.fromEntries(Object.entries(gameP2.gameState.characters).map(([id, c]) => [id, c.hp]))
    );
  });
});
