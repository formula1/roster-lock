import { GameState } from "@roster-lock/example-game-engine";
import { RosterLockV1Config } from "@roster-lock/types";
import { characterDisplayName } from "../../game/characterNames";

type Character = GameState["characters"][string];

export function CharacterSprite({
  character,
  rosterConfig,
  spriteUrl,
  isAlly,
}: {
  character: Character;
  rosterConfig: RosterLockV1Config;
  spriteUrl: string | null;
  isAlly: boolean;
}) {
  const down = character.hp.current <= 0;

  return (
    <div className={`character-sprite ${isAlly ? "ally" : "enemy"} ${down ? "down" : ""}`}>
      {spriteUrl ? (
        <img src={spriteUrl} alt={characterDisplayName(rosterConfig, character.id)} />
      ) : (
        <div className="sprite-placeholder" />
      )}
      <div className="sprite-label">
        <span className="name">{characterDisplayName(rosterConfig, character.id)}</span>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(character.hp.current / character.hp.max) * 100}%` }}
          />
        </div>
        <span className="hp-text">
          HP {character.hp.current}/{character.hp.max}
          {down ? " (down)" : ""}
        </span>
      </div>
    </div>
  );
}
