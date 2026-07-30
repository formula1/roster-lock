import { useMemo, CSSProperties } from "react";
import { WeatherParticles } from "../../game/weatherParticles";

type ParticleInstance = {
  key: string;
  left: number;
  top: number;
  size: number;
  color: string;
  opacity: number;
  duration: number;
  delay: number;
  motion: "fall" | "pulse" | "twinkle";
  shape: string;
  trail: boolean;
  rotate: boolean;
};

// Caps how many DOM nodes a single group can spawn - particles.json's counts
// (up to 80) are tuned for a real particle system, not one <span> each.
const MAX_PER_GROUP = 40;

function spawnRange(spawnArea: string): { left: [number, number]; top: [number, number] } {
  switch (spawnArea) {
    case "top":
      return { left: [0, 100], top: [-10, 0] };
    case "bottom":
      return { left: [0, 100], top: [85, 100] };
    case "top-right":
      return { left: [55, 100], top: [0, 35] };
    default:
      return { left: [0, 100], top: [0, 100] };
  }
}

function motionFor(spawnArea: string): ParticleInstance["motion"] {
  if (spawnArea === "top") return "fall";
  if (spawnArea === "bottom") return "pulse";
  return "twinkle";
}

// particles.json's "speed" means translational speed (how fast a particle
// crosses the field), which only makes sense to invert into a CSS
// animation-duration for motions that actually travel (fall/pulse). Ambient
// in-place motions (twinkle - sun's lens-flare/shimmer) use a low "speed" to
// mean "lazy", which inverted the same way produces 60-90s cycles - so slow
// the effect never visibly pulses within a normal glance at the screen.
// Twinkle gets its own short, fixed cycle instead.
function durationFor(motion: ParticleInstance["motion"], speed: number): number {
  if (motion === "twinkle") return 2 + Math.random() * 3;
  return 12 / speed + Math.random() * (6 / speed);
}

function buildInstances(particles: WeatherParticles): Array<ParticleInstance> {
  const instances: Array<ParticleInstance> = [];
  particles.particles.forEach((group, groupIndex) => {
    const count = Math.min(group.count, MAX_PER_GROUP);
    const { left, top } = spawnRange(group.spawnArea);
    const [minSize, maxSize] = group.size;
    const speed = Math.max(group.speed, 0.1);
    const motion = motionFor(group.spawnArea);
    for (let i = 0; i < count; i++) {
      instances.push({
        key: `${particles.id}-${groupIndex}-${i}`,
        left: left[0] + Math.random() * (left[1] - left[0]),
        top: top[0] + Math.random() * (top[1] - top[0]),
        size: minSize + Math.random() * (maxSize - minSize),
        color: group.color,
        opacity: group.opacity,
        duration: durationFor(motion, speed),
        delay: Math.random() * 6,
        motion,
        shape: group.shape,
        trail: Boolean(group.trail),
        rotate: Boolean(group.rotate ?? group.pulse),
      });
    }
  });
  return instances;
}

export function WeatherOverlay({ particles }: { particles: WeatherParticles | null }) {
  const instances = useMemo(() => (particles ? buildInstances(particles) : []), [particles]);

  if (!particles) return null;

  return (
    <div className="weather-overlay" aria-hidden="true" title={particles.label}>
      {particles.overlay.color && particles.overlay.opacity > 0 && (
        <div
          className="weather-tint"
          style={{ background: particles.overlay.color, opacity: particles.overlay.opacity }}
        />
      )}
      {instances.map((p) => (
        <span
          key={p.key}
          className={`weather-particle shape-${p.shape} motion-${p.motion}${p.rotate ? " rotate" : ""}${p.trail ? " trail" : ""}`}
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            color: p.color,
            opacity: p.opacity,
            "--max-opacity": p.opacity,
            animationDuration: `${p.duration}s`,
            animationDelay: `${-p.delay}s`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
