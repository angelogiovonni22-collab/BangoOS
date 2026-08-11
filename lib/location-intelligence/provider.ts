import type { LocationForecast } from "./types";

type GeocodingResult = {
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  admin1?: string;
  country?: string;
  postcodes?: string[];
};

type LocationHint = {
  state?: string | null;
  postalCode?: string | null;
};

const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

type ForecastResponse = {
  timezone: string;
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
  };
};

export function weatherCondition(code: number) {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorms";
  return "Mixed conditions";
}

export async function getLocationForecast(search: string | string[], hint: LocationHint = {}): Promise<LocationForecast> {
  const apiKey = process.env.OPEN_METEO_API_KEY?.trim();
  const candidates = [...new Set((Array.isArray(search) ? search : [search]).map((value) => value.trim()).filter(Boolean))];
  let place: GeocodingResult | undefined;

  for (const candidate of candidates) {
    const geocodeUrl = new URL(apiKey
      ? "https://customer-geocoding-api.open-meteo.com/v1/search"
      : "https://geocoding-api.open-meteo.com/v1/search");
    geocodeUrl.searchParams.set("name", candidate);
    geocodeUrl.searchParams.set("count", "10");
    geocodeUrl.searchParams.set("language", "en");
    geocodeUrl.searchParams.set("format", "json");
    geocodeUrl.searchParams.set("countryCode", "US");
    if (apiKey) geocodeUrl.searchParams.set("apikey", apiKey);

    const geocodeResponse = await fetch(geocodeUrl, { next: { revalidate: 86400 } });
    if (!geocodeResponse.ok) continue;
    const geocodePayload = await geocodeResponse.json() as { results?: GeocodingResult[] };
    place = selectBestPlace(geocodePayload.results || [], hint);
    if (place) break;
  }
  if (!place) throw new Error("No matching location was found. Check the jobsite ZIP code or address.");

  const forecastUrl = new URL(apiKey
    ? "https://customer-api.open-meteo.com/v1/forecast"
    : "https://api.open-meteo.com/v1/forecast");
  forecastUrl.searchParams.set("latitude", String(place.latitude));
  forecastUrl.searchParams.set("longitude", String(place.longitude));
  forecastUrl.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m");
  forecastUrl.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max");
  forecastUrl.searchParams.set("temperature_unit", "fahrenheit");
  forecastUrl.searchParams.set("wind_speed_unit", "mph");
  forecastUrl.searchParams.set("timezone", "auto");
  forecastUrl.searchParams.set("forecast_days", "7");
  if (apiKey) forecastUrl.searchParams.set("apikey", apiKey);

  const weatherResponse = await fetch(forecastUrl, { next: { revalidate: 900 } });
  if (!weatherResponse.ok) throw new Error("Live weather is temporarily unavailable for this jobsite.");
  const weather = await weatherResponse.json() as ForecastResponse;

  return {
    location: [place.name, place.admin1].filter(Boolean).join(", "),
    resolvedAddress: [place.name, place.admin1, place.country].filter(Boolean).join(", "),
    postalCode: place.postcodes?.[0] ?? null,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: weather.timezone || place.timezone || "auto",
    observedAt: weather.current.time,
    current: {
      temperatureF: Math.round(weather.current.temperature_2m),
      apparentTemperatureF: Math.round(weather.current.apparent_temperature),
      weatherCode: weather.current.weather_code,
      condition: weatherCondition(weather.current.weather_code),
      windMph: Math.round(weather.current.wind_speed_10m),
    },
    days: weather.daily.time.slice(0, 7).map((date, index) => ({
      date,
      weatherCode: weather.daily.weather_code[index] ?? -1,
      condition: weatherCondition(weather.daily.weather_code[index] ?? -1),
      highF: Math.round(weather.daily.temperature_2m_max[index] ?? 0),
      lowF: Math.round(weather.daily.temperature_2m_min[index] ?? 0),
      precipitationProbability: Math.round(weather.daily.precipitation_probability_max[index] ?? 0),
      windMph: Math.round(weather.daily.wind_speed_10m_max[index] ?? 0),
    })),
    attribution: "Weather data by Open-Meteo; location data by GeoNames",
  };
}

export function selectBestPlace(results: GeocodingResult[], hint: LocationHint) {
  const postalCode = hint.postalCode?.trim().toLowerCase() || "";
  const rawState = hint.state?.trim() || "";
  const stateName = US_STATE_NAMES[rawState.toUpperCase()] || rawState;
  const normalizedState = stateName.toLowerCase();

  return [...results].sort((left, right) => scorePlace(right) - scorePlace(left))[0];

  function scorePlace(place: GeocodingResult) {
    let score = 0;
    if (postalCode && place.postcodes?.some((value) => value.trim().toLowerCase() === postalCode)) score += 100;
    if (normalizedState && place.admin1?.trim().toLowerCase() === normalizedState) score += 50;
    if (place.country?.trim().toLowerCase() === "united states") score += 5;
    return score;
  }
}
