import { useState } from "react";
import { Game, GameState, MoveDescription } from "@roster-lock/example-game-engine";
import { RosterLockV1Config } from "@roster-lock/types";
import { characterDisplayName } from "../../game/characterNames";

type CharacterState = GameState["characters"][string];
type Choice = { moveId: string; targetId: string };

function buildInitialChoices(myCharacters: Array<CharacterState>, enemies: Array<CharacterState>) {
  const initial: Record<string, Choice> = {};
  for (const character of myCharacters) {
    const firstMove = Object.keys(character.moves)[0];
    if (firstMove) initial[character.id] = { moveId: firstMove, targetId: enemies[0]?.id ?? "" };
  }
  return initial;
}

// The move-picker UI headless's buildMovesForTurn (3-game/moves.ts) doesn't
// have - it just fires a random known move at a living enemy. This resolves
// Game.create's moveRequest callback from real user input instead: pick a
// move per living controlled character, and (for any non-weather effect in
// that move) a target enemy - same config shape headless builds
// ({} for weather effects, {targets: [id]} otherwise).
export function MoveForm({
  game,
  localPlayer,
  rosterConfig,
  onSubmit,
}: {
  game: Game;
  localPlayer: string;
  rosterConfig: RosterLockV1Config;
  onSubmit: (moves: Array<Omit<MoveDescription, "player">>) => void;
}) {
  const characters = Object.values(game.gameState.characters);
  const myCharacters = characters.filter((c) => c.controllerPlayer === localPlayer && c.hp.current > 0);
  const enemies = characters.filter((c) => c.ownerPlayer !== localPlayer && c.hp.current > 0);

  const [choices, setChoices] = useState<Record<string, Choice>>(() =>
    buildInitialChoices(myCharacters, enemies),
  );

  function setChoice(characterId: string, patch: Partial<Choice>) {
    setChoices((prev) => ({
      ...prev,
      [characterId]: { ...(prev[characterId] ?? { moveId: "", targetId: "" }), ...patch },
    }));
  }

  function handleSubmit() {
    const moves: Array<Omit<MoveDescription, "player">> = [];
    for (const character of myCharacters) {
      const choice = choices[character.id];
      if (!choice?.moveId) continue;
      const move = character.moves[choice.moveId];
      if (!move) continue;
      const config: Record<string, any> = {};
      for (const [key, effect] of Object.entries(move)) {
        config[key] = effect.type === "weather" ? {} : { targets: [choice.targetId] };
      }
      moves.push({ characterId: character.id, move: { id: choice.moveId, config } });
    }
    onSubmit(moves);
  }

  if (myCharacters.length === 0) {
    return <div className="banner">You have no living characters to act with this turn.</div>;
  }

  const ready = myCharacters.every((c) => choices[c.id]?.moveId);

  return (
    <div className="piece-type-section">
      <h3>Choose your moves</h3>
      {myCharacters.map((character) => {
        const moveIds = Object.keys(character.moves);
        const choice = choices[character.id];
        const chosenMove = choice?.moveId ? character.moves[choice.moveId] : undefined;
        const needsTarget = chosenMove ? Object.values(chosenMove).some((e) => e.type !== "weather") : false;

        return (
          <div key={character.id} className="download-row">
            <div className="row-label">
              <span>{characterDisplayName(rosterConfig, character.id)}</span>
              <span>
                HP {character.hp.current}/{character.hp.max}
              </span>
            </div>

            <label htmlFor={`move-${character.id}`}>Move</label>
            <select
              id={`move-${character.id}`}
              value={choice?.moveId ?? ""}
              onChange={(e) => setChoice(character.id, { moveId: e.target.value })}
            >
              {moveIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>

            {needsTarget && (
              <>
                <label htmlFor={`target-${character.id}`}>Target</label>
                <select
                  id={`target-${character.id}`}
                  value={choice?.targetId ?? ""}
                  onChange={(e) => setChoice(character.id, { targetId: e.target.value })}
                >
                  {enemies.map((enemy) => (
                    <option key={enemy.id} value={enemy.id}>
                      {characterDisplayName(rosterConfig, enemy.id)}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        );
      })}
      <div className="actions">
        <button disabled={!ready} onClick={handleSubmit}>
          Submit Moves
        </button>
      </div>
    </div>
  );
}
