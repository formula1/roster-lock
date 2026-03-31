
export enum WeatherType {
  None = "none",
  Sun = "sun",
  Rain = "rain",
  Snow = "snow",
}

export type Stage = {
  weather: { type: WeatherType, turnsLeft: number },
}
