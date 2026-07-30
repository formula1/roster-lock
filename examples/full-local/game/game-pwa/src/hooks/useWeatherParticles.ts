import { useEffect, useRef, useState } from "react";
import { RosterLockV1Config } from "@roster-lock/types";
import { getPieceFileJSON } from "../game/pieceFiles";
import { WeatherParticles } from "../game/weatherParticles";
import { useGameSession } from "../context/GameSessionContext";

const PARTICLES_FILE = "media/particles.json";

// Weather roster piece ids are namespaced as "weather-<type>" (e.g.
// "weather-rain" - see simple-game.roster-lock.json), while
// GameState.stage.weather.type is the bare WeatherType value ("rain"). There's
// no other link between the two, so match on that naming convention.
export function useWeatherParticles(rosterConfig: RosterLockV1Config, weatherType: string) {
  const { matchAgent } = useGameSession();
  const [particles, setParticles] = useState<Record<string, WeatherParticles>>({});
  const started = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!matchAgent || started.current.has(weatherType)) return;
    started.current.add(weatherType);

    const piece = (rosterConfig.rosters.weather ?? [])
      .find((p) => p.id === weatherType || p.id.endsWith(`-${weatherType}`));
    if (!piece) return;

    const info = { version: 1 as const, engine: rosterConfig.engine, pieceType: "weather", piece };
    getPieceFileJSON<WeatherParticles>({ ...info, filePath: PARTICLES_FILE }, matchAgent.authCode, matchAgent.url)
      .catch(() => null)
      .then((value) => {
        if (!value) return;
        setParticles((prev) => ({ ...prev, [weatherType]: value }));
      });
  }, [matchAgent, rosterConfig, weatherType]);

  return particles[weatherType] ?? null;
}
