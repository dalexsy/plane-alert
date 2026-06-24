export interface WeatherData {
  windDirection: number;
  windSpeed: number;
  windStat: number;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  lastUpdated: number;
}

export interface AstronomicalData {
  sunAngle: number;
  moonAngle: number;
  isNight: boolean;
  moonFraction: number;
  moonPhase: string;
  moonIsWaning: boolean;
  sunEventText: string;
  lastUpdated: number;
}

export interface EnvironmentalState {
  weather: WeatherData | null;
  astronomical: AstronomicalData | null;
  currentLocation: { lat: number; lon: number } | null;
  isLoading: boolean;
  error?: string;
}
