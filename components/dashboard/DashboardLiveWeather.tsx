"use client";

import { useEffect, useState } from "react";
import { CloudMoon, CloudSun } from "lucide-react";
import weatherSceneStyles from "@/components/location-intelligence/location-weather-scene.module.css";

type WeatherPayload = {
  ok: boolean;
  error?: string;
  forecast: {
    location: string;
    current: {
      isDay: boolean;
      temperatureF: number;
      apparentTemperatureF: number;
      condition: string;
      windMph: number;
      weatherCode: number;
    };
    hours: Array<{ time: string; temperatureF: number; precipitationProbability: number }>;
    days: Array<{ highF: number; lowF: number }>;
  };
};

export function DashboardLiveWeather({ projectId }: { projectId: string | null }) {
  const [payload, setPayload] = useState<WeatherPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));

  useEffect(() => {
    if (!projectId) return;

    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/location-intelligence/weather?projectId=${encodeURIComponent(projectId)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json()) as WeatherPayload;
        if (!response.ok || !result.ok) throw new Error(result.error || "Weather unavailable");
        setPayload(result);
      } catch {
        if (!controller.signal.aborted) setPayload(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(load, 10 * 60 * 1000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [projectId]);

  if (loading) return <div className="mx-5 mb-4 h-[104px] animate-pulse rounded-xl bg-[#edf3fa]" />;

  if (!payload) {
    return (
      <div className="mx-5 mb-4 flex min-h-[104px] items-center justify-center rounded-xl border border-dashed border-[#cbd6e4] bg-[#f7f9fc] px-4 text-center">
        <p className="max-w-[230px] text-[10px] font-medium leading-4 text-[#718096]">Add a valid jobsite address to this project to load live weather.</p>
      </div>
    );
  }

  const { current, days, hours, location } = payload.forecast;
  return (
    <div
      data-live-weather
      data-kind={weatherSceneKind(current.weatherCode)}
      data-is-day={current.isDay}
      className={`${weatherSceneStyles.headerScene} mx-5 mb-4 min-h-[104px] overflow-hidden rounded-xl px-4 py-3`}
    >
      <WeatherAtmosphere />
      <div className="relative z-[1] flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 bg-[#16385f]/60 text-white backdrop-blur-sm">
            {current.isDay ? <CloudSun size={21} /> : <CloudMoon size={21} />}
          </span>
          <div className="min-w-0">
            <div className="flex items-end gap-2">
              <p className="text-[31px] font-light leading-none tracking-[-0.04em] text-white">{current.temperatureF}°</p>
              <p className="pb-0.5 text-[11px] font-bold text-white">{current.condition}</p>
            </div>
            <p className="mt-1 truncate text-[9px] font-semibold text-[#e0ecf8]">{location} · Feels {current.apparentTemperatureF}° · Wind {current.windMph} mph</p>
          </div>
        </div>
        <div className="shrink-0 text-right text-[9px] font-semibold text-[#e0ecf8]">
          {days[0] ? <p>H {days[0].highF}° · L {days[0].lowF}°</p> : null}
          {hours[0] ? <p className="mt-1">Rain {hours[0].precipitationProbability}%</p> : null}
        </div>
      </div>
    </div>
  );
}

function WeatherAtmosphere() {
  return (
    <div className={weatherSceneStyles.atmosphere} aria-hidden="true">
      <span className={weatherSceneStyles.skyGlow} />
      <span className={weatherSceneStyles.sun} />
      <span className={weatherSceneStyles.stars} />
      <span className={weatherSceneStyles.moon} />
      <span className={weatherSceneStyles.cloudBack} />
      <span className={weatherSceneStyles.cloudMiddle} />
      <span className={weatherSceneStyles.cloudFront} />
      <span className={weatherSceneStyles.rainFar} />
      <span className={weatherSceneStyles.rainNear} />
      <span className={weatherSceneStyles.snowFar} />
      <span className={weatherSceneStyles.snowNear} />
      <span className={weatherSceneStyles.fogBack} />
      <span className={weatherSceneStyles.fogFront} />
      <span className={weatherSceneStyles.flash} />
      <span className={weatherSceneStyles.vignette} />
    </div>
  );
}

function weatherSceneKind(code: number) {
  if (code === 0) return "clear";
  if (code <= 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "snow";
  if (code >= 95) return "storm";
  return "cloud";
}
