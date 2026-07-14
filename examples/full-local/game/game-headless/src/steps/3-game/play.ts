import { RosterLockV1SyncDLResult } from "@roster-lock/types";
import { Game } from "@roster-lock/example-game-engine";
import { PeerRoom } from "./datachannel-room";
import { CurrentUser } from "../types";
import { toGameRoom } from "./room-adapter";
import { getFileContents } from "./getFileContents";
import { buildMovesForTurn } from "./moves";

export type GameSummary = {
  winners: Array<string>,
  turnCount: number,
  randomSeed: Record<string, string>,
};

export async function playGame(
  room: PeerRoom,
  user: CurrentUser,
  gameResult: RosterLockV1SyncDLResult,
): Promise<GameSummary> {
  const gameRoom = toGameRoom(room);
  const ownerPlayer = user.keys.publicKey;

  let game: Game;
  game = await Game.create(
    gameRoom, gameResult, () => buildMovesForTurn(game, ownerPlayer), getFileContents
  );

  const winners = await game.gameLoop();
  console.log("Game finished. Winners:", winners);
  return { winners, turnCount: game.gameState.turnCount, randomSeed: game.randomSeed };
}
