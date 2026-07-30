import { Game, MoveDescription } from "@roster-lock/example-game-engine";

// No UI to ask a human for a move yet, so each turn just picks a random known
// move from the character's own loaded moveset and fires it at a living enemy.
export async function buildMovesForTurn(
  game: Game, ownerPlayer: string
): Promise<Array<Omit<MoveDescription, "player">>> {
  const { characters } = game.gameState;
  const moves: Array<Omit<MoveDescription, "player">> = [];

  for(const character of Object.values(characters)){
    if(character.controllerPlayer !== ownerPlayer) continue;
    if(character.hp.current <= 0) continue;
    const enemy = Object.values(characters).find(
      (other) => other.ownerPlayer !== ownerPlayer && other.hp.current > 0
    );
    if(!enemy) continue;

    const moveIds = Object.keys(character.moves);
    if(moveIds.length === 0) continue;
    const moveId = moveIds[Math.floor(Math.random() * moveIds.length)]!;
    const runnableMove = character.moves[moveId]!;

    const config: Record<string, any> = {};
    for(const [key, effect] of Object.entries(runnableMove)){
      config[key] = effect.type === "weather" ? {} : { targets: [enemy.id] };
    }

    moves.push({ characterId: character.id, move: { id: moveId, config } });
  }
  return moves;
}
