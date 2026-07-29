import { GameState } from "@roster-lock/example-game-engine";
import { RosterLockV1Config, RosterLockV1SyncDLResult } from "@roster-lock/types";
import { useStageBackground } from "../../hooks/useStageBackground";
import { useWeatherParticles } from "../../hooks/useWeatherParticles";
import { useCharacterSprites } from "../../hooks/useCharacterSprites";
import { CharacterSprite } from "./CharacterSprite";
import { WeatherOverlay } from "./WeatherOverlay";

export function Battlefield({
  gameState,
  rosterConfig,
  downloadResult,
  localPlayer,
}: {
  gameState: GameState;
  rosterConfig: RosterLockV1Config;
  downloadResult: RosterLockV1SyncDLResult;
  localPlayer: string;
}) {
  const characters = Object.values(gameState.characters);
  const allies = characters.filter((c) => c.ownerPlayer === localPlayer);
  const enemies = characters.filter((c) => c.ownerPlayer !== localPlayer);

  const backgroundUrl = useStageBackground(rosterConfig, downloadResult);
  const particles = useWeatherParticles(rosterConfig, gameState.stage.weather.type);
  const { spriteFor } = useCharacterSprites(
    rosterConfig,
    characters.map((c) => c.id),
  );

  return (
    <div
      className="battlefield"
      style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : undefined}
    >
      <WeatherOverlay particles={particles} />

      {/* Enemies face the viewer (front sprite); allies are seen from behind
          (back sprite), same as they'd look to the enemy standing opposite. */}
      <div className="battle-row enemy-row">
        {enemies.map((character) => (
          <CharacterSprite
            key={character.id}
            character={character}
            rosterConfig={rosterConfig}
            spriteUrl={spriteFor(character.id).frontUrl}
            isAlly={false}
          />
        ))}
      </div>
      <div className="battle-row ally-row">
        {allies.map((character) => (
          <CharacterSprite
            key={character.id}
            character={character}
            rosterConfig={rosterConfig}
            spriteUrl={spriteFor(character.id).backUrl}
            isAlly={true}
          />
        ))}
      </div>
    </div>
  );
}
