export type WeatherParticleGroup = {
  shape: string;
  count: number;
  color: string;
  size: [number, number];
  speed: number;
  angle?: number;
  drift?: number;
  spawnArea: string;
  opacity: number;
  trail?: boolean;
  rotate?: boolean;
  pulse?: boolean;
};

export type WeatherParticles = {
  id: string;
  type: string;
  label: string;
  description: string;
  overlay: { color: string | null; opacity: number };
  particles: Array<WeatherParticleGroup>;
};
