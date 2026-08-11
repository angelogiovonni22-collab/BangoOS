export type ForecastDay = {
  date: string;
  weatherCode: number;
  condition: string;
  highF: number;
  lowF: number;
  precipitationProbability: number;
  windMph: number;
};

export type LocationForecast = {
  location: string;
  resolvedAddress: string;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
  observedAt: string;
  current: {
    temperatureF: number;
    apparentTemperatureF: number;
    weatherCode: number;
    condition: string;
    windMph: number;
  };
  days: ForecastDay[];
  attribution: string;
};
