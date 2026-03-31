import { RosterLockV1SyncDLResult } from "@roster-lock/types";
import { createSimpleEmitter } from "./utils/SimpleEvent";

import { Room } from "./room";
import { GameState, MoveDescription, FinalState, TurnState, ModifierState } from "./types";

import { prepareGlobalRandom } from "./game/prepare-random";
import { MoveSharer } from "./game/MoveSharer";
import { prepareTurn } from "./game/prepare-turn";
import { runTurn } from "./game/run-turn";

const MAX_CHARACTERS_PER_PLAYER = 2;

type GameStates = (
  | ["waitingForMoves", { state: GameState }]
  | ["turnBegin", { state: GameState, turnState: TurnState }]
  | ["runningTurnPoint", {
    speed: number, state: GameState, moves: TurnState["speedPoints"][number]["moves"], modifiers: ModifierState,
  }]
  | ["turnEnd", { state: GameState }]
  | ["gameEnd", { state: GameState, winners: Array<string> }]
);


export class Game {
  onStateUpdate = createSimpleEmitter<GameStates>()

  private moveSharer: MoveSharer;
  constructor(
    private room: Room,
    private finalState: FinalState,
    private gameState: GameState,
    private moveRequest: ()=>Promise<Array<Omit<MoveDescription, "player">>>
  ){
    gameState.winners = null;
    const charCount = new Map<string, number>();
    for(const character of Object.values(this.gameState.characters)){
      if(!this.gameState.players[character.ownerPlayer]){
        throw new Error(`Player ${character.ownerPlayer} not found`);
      }
      const count = (charCount.get(character.ownerPlayer) || 0) + 1;
      charCount.set(character.ownerPlayer, count);
      if(count > MAX_CHARACTERS_PER_PLAYER){
        throw new Error(`Player ${character.ownerPlayer} has too many characters`);
      }
      for(const move of character.moves){
        if(!this.finalState.availableMoves[move]){
          throw new Error(`Move ${move} not found for character ${character.id}`);
        }
      }
    }
    const players = Object.values(this.gameState.players);
    if(new Set(players.map(p=>p.id)).size !== players.length){
      throw new Error(`Duplicate player ids`);
    }
    if(players.length !== this.room.userIds.length){
      throw new Error(`Player count does not match room user count`);
    }
    for(const player of players){
      if(!this.room.userIds.includes(player.id)){
        throw new Error(`Player ${player.id} not found in room`);
      }
      if(charCount.get(player.id) !== MAX_CHARACTERS_PER_PLAYER){
        throw new Error(`Player ${player.id} does not have enough characters`);
      }
    }

    this.moveSharer = new MoveSharer(
      this.room, this.moveRequest
    );
  }

  async prepareGame(
    selectionDownloadResult: RosterLockV1SyncDLResult,
  ){
    await Promise.all([
      loadAssets(selectionDownloadResult.downloadResults),
      prepareGlobalRandom(this.room),
    ]);
  }


  async gameLoop(){
    try {
      this.gameState.turnCount = 0;
      while(true){
        this.onStateUpdate.emit("waitingForMoves", { state: this.gameState });
        const rawMoves = await this.moveSharer.waitForValues();
        const turnState = prepareTurn(this.finalState, this.gameState, rawMoves);
        this.onStateUpdate.emit("turnBegin", { state: this.gameState, turnState });
        for(const { point, moves, modifiers } of runTurn(this.finalState, this.gameState, turnState)){
          this.onStateUpdate.emit(
            "runningTurnPoint", { speed: point, state: this.gameState, moves, modifiers }
          );
        }
        if(this.gameState.winners){
          this.onStateUpdate.emit("gameEnd", { state: this.gameState, winners: this.gameState.winners });
          return this.gameState.winners;
        }
        this.onStateUpdate.emit("turnEnd", { state: this.gameState });
        this.gameState.turnCount++;
      }
    }catch(e){
      console.error("Game failed:", e);
      this.moveSharer.destroy();
      this.room.broadcastAction("error", (e as Error).message);
      throw e;
    }
  }
}


