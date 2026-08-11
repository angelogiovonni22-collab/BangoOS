import { LocationForecastCard } from "@/components/location-intelligence";
import type { WeatherSnapshot } from "@/lib/dashboard/types";

type WeatherWidgetProps = {
  weather: WeatherSnapshot | null;
  errorMessage?: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function WeatherWidget(props: WeatherWidgetProps) {
  void props;
  return <LocationForecastCard title="Active Job Weather" compact />;
}
