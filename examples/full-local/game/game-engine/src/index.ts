import { RosterLockV1SyncDLResult } from "@roster-lock/types";
import { createSimpleEmitter } from "./utils/SimpleEvent";

import { Room } from "./room";
import { GameState, MoveDescription, TurnState, ModifierState } from "./types";

import { prepareGlobalRandom } from "./game/prepare-random";
import { buildGameFromSelection } from "./game/build-game";
import { GetFileContents } from "./game/assets/loadPieceFile";
import { MoveSharer } from "./game/MoveSharer";
import { prepareTurn } from "./game/prepare-turn";
import { runTurn } from "./game/run-turn";
import { createRandom, Random } from "./utils/Random";

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

  // Public so game clients (UI, headless runners) can read live state directly,
  // not just through onStateUpdate.
  public readonly gameState: GameState;
  // Owned per-Game rather than a process-wide singleton, so two Game instances in the
  // same process (e.g. simulating two peers in a test) never draw from each other's sequence.
  private readonly random: Random = createRandom();

  private moveSharer: MoveSharer;

  // Building gameState off a RosterLockV1SyncDLResult means reading piece files off disk,
  // which is async — so construction goes through the static `create` below instead of a
  // plain constructor.
  static async create(
    room: Room,
    selectionDownloadResult: RosterLockV1SyncDLResult,
    moveRequest: ()=>Promise<Array<Omit<MoveDescription, "player">>>,
    getFileContents: GetFileContents,
  ): Promise<Game> {
    const { gameState } = await buildGameFromSelection(selectionDownloadResult, getFileContents);
    const game = new Game(room, gameState, moveRequest);
    await prepareGlobalRandom(room, game.random);
    return game;
  }

  private constructor(
    private room: Room,
    gameState: GameState,
    private moveRequest: ()=>Promise<Array<Omit<MoveDescription, "player">>>
  ){
    this.gameState = gameState;

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

  async gameLoop(){
    try {
      this.gameState.turnCount = 0;
      while(true){
        this.onStateUpdate.emit("waitingForMoves", { state: this.gameState });
        const rawMoves = await this.moveSharer.waitForValues();
        const turnState = prepareTurn(this.gameState, rawMoves, this.random);
        this.onStateUpdate.emit("turnBegin", { state: this.gameState, turnState });
        for(const { point, moves, modifiers } of runTurn(this.gameState, turnState, this.random)){
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
