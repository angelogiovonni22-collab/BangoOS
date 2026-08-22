"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CloudSun, MapPin, Navigation } from "lucide-react";
import weatherSceneStyles from "@/components/location-intelligence/location-weather-scene.module.css";

type HeaderWeatherPayload = {
  ok: boolean;
  error?: string;
  directionsAddress: string;
  forecast: {
    location: string;
    current: {
      temperatureF: number;
      apparentTemperatureF: number;
      condition: string;
      windMph: number;
      weatherCode: number;
    };
    days: Array<{ highF: number; lowF: number }>;
  };
};

export function ProjectHeaderWeatherStrip() {
  const params = useParams<{ id?: string | string[] }>();
  const projectId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [payload, setPayload] = useState<HeaderWeatherPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    const updateVisibility = () => {
      const visible = document.visibilityState === "visible";
      setPageVisible(visible);
      if (visible) setRefreshNonce((value) => value + 1);
    };

    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  useEffect(() => {
    if (!pageVisible) return;
    const timer = window.setInterval(() => setRefreshNonce((value) => value + 1), 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [pageVisible]);

  useEffect(() => {
    if (!projectId || !pageVisible) return;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/location-intelligence/weather?projectId=${encodeURIComponent(projectId)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const result = (await response.json()) as HeaderWeatherPayload;
        if (!response.ok || !result.ok) throw new Error(result.error || "Weather unavailable");
        setPayload(result);
      } catch {
        if (!controller.signal.aborted) setPayload(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [pageVisible, projectId, refreshNonce]);

  const directionsHref = useMemo(() => {
    if (!payload?.directionsAddress) return null;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(payload.directionsAddress)}`;
  }, [payload?.directionsAddress]);

  const mapEmbed = payload?.directionsAddress
    ? `https://www.google.com/maps?q=${encodeURIComponent(payload.directionsAddress)}&output=embed`
    : null;

  if (!projectId) return null;

  return (
    <section
      data-project-header-jobsite-intelligence="true"
      className="mt-3 overflow-hidden rounded-[16px] border border-[#345783] bg-[linear-gradient(135deg,#0e2546,#102d52_52%,#0c213d)] shadow-[0_14px_30px_-22px_rgba(0,0,0,0.9)]"
    >
      {loading ? (
        <div className="h-[112px] animate-pulse bg-white/5" />
      ) : payload ? (
        <div className="grid min-h-[112px] grid-cols-1 divide-y divide-[#31537e] lg:grid-cols-[1.05fr_1fr_0.9fr] lg:divide-x lg:divide-y-0">
          <div
            data-live-weather
            data-kind={weatherSceneKind(payload.forecast.current.weatherCode)}
            data-paused={!pageVisible}
            className={`${weatherSceneStyles.headerScene} flex items-center gap-4 px-5 py-4`}
          >
            <WeatherAtmosphere />
            <span className="relative z-[1] inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#ffffff4d] bg-[#16385f]/70 text-[#f2f8ff] backdrop-blur-sm">
              <CloudSun size={22} aria-hidden="true" />
            </span>
            <div className="relative z-[1] min-w-0">
              <div className="flex items-end gap-3">
                <p className="text-[2.4rem] font-light leading-none tracking-[-0.05em] text-white">{payload.forecast.current.temperatureF}°</p>
                <div className="pb-0.5">
                  <p className="text-sm font-bold text-white">{payload.forecast.current.condition}</p>
                  <p className="text-[11px] font-semibold text-[#e0ecf8]">Feels like {payload.forecast.current.apparentTemperatureF}° · Wind {payload.forecast.current.windMph} mph</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-[#e0ecf8]">
                <span className="inline-flex items-center gap-1"><MapPin size={11} aria-hidden="true" />{payload.forecast.location}</span>
                {payload.forecast.days[0] ? <span>H: {payload.forecast.days[0].highF}° · L: {payload.forecast.days[0].lowF}°</span> : null}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8faed3]">Jobsite</p>
              <p className="mt-1 truncate text-sm font-bold text-white" title={payload.directionsAddress}>{payload.directionsAddress}</p>
              <p className="mt-1 text-[11px] font-medium text-[#afc5e2]">Live project location</p>
            </div>
            {directionsHref ? (
              <a
                href={directionsHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-[#5c85ba] bg-[#164e91] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#1d62b2]"
              >
                <Navigation size={13} aria-hidden="true" />Directions
              </a>
            ) : null}
          </div>

          <div className="relative min-h-[112px] bg-[#dfe9f2]">
            {mapEmbed ? <iframe title={`Map of ${payload.directionsAddress}`} src={mapEmbed} className="absolute inset-0 h-full w-full" loading="lazy" /> : null}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[92px] items-center gap-3 px-5 py-4 text-sm font-semibold text-[#c6d8ef]">
          <CloudSun size={18} aria-hidden="true" />Jobsite weather and map are temporarily unavailable.
        </div>
      )}
    </section>
  );
}

function WeatherAtmosphere() {
  return (
    <div className={weatherSceneStyles.atmosphere} aria-hidden="true">
      <span className={weatherSceneStyles.skyGlow} />
      <span className={weatherSceneStyles.sun} />
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
