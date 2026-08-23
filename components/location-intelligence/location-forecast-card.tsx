"use client";

import { useEffect, useMemo, useState } from "react";
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, ExternalLink, MapPin, Navigation, RefreshCw, Sun } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import type { LocationForecast } from "@/lib/location-intelligence";
import weatherSceneStyles from "./location-weather-scene.module.css";

type ForecastPayload = {
  ok: boolean;
  error?: string;
  projectId: string | null;
  projectName: string | null;
  directionsAddress: string;
  forecast: LocationForecast;
};

type LocationForecastCardProps = {
  projectId?: string;
  fallbackDirectionsAddress?: string;
  title?: string;
  showMap?: boolean;
  compact?: boolean;
};

export function LocationForecastCard({ projectId, fallbackDirectionsAddress, title = "Jobsite Weather", showMap = false, compact = false }: LocationForecastCardProps) {
  const [postalCode, setPostalCode] = useState("");
  const [appliedPostalCode, setAppliedPostalCode] = useState("");
  const [payload, setPayload] = useState<ForecastPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState<Date | null>(null);
  const [pageVisible, setPageVisible] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [forecastMode, setForecastMode] = useState<"hourly" | "daily">("hourly");

  useEffect(() => {
    const updateClock = () => setClock(new Date());
    updateClock();
    const timer = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(timer);
  }, []);

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
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (projectId) params.set("projectId", projectId);
      if (appliedPostalCode) params.set("postalCode", appliedPostalCode);
      try {
        const response = appliedPostalCode && projectId
          ? await fetch("/api/location-intelligence/weather", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, postalCode: appliedPostalCode }),
            signal: controller.signal,
          })
          : await fetch(`/api/location-intelligence/weather?${params}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json() as ForecastPayload;
        if (!response.ok || !result.ok) throw new Error(result.error || "Weather is unavailable.");
        setPayload(result);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setPayload(null);
          setError(caught instanceof Error ? caught.message : "Weather is unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [appliedPostalCode, projectId, refreshNonce]);

  const directionsAddress = payload?.directionsAddress || fallbackDirectionsAddress || null;
  const directionsHref = useMemo(() => directionsAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(directionsAddress)}`
    : null, [directionsAddress]);
  const mapHref = directionsAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directionsAddress)}` : null;
  const mapEmbed = directionsAddress ? `https://www.google.com/maps?q=${encodeURIComponent(directionsAddress)}&output=embed` : null;

  return (
    <Card as="section" variant="elevated" className="min-w-0">
      <CardHeader className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2"><CloudSun size={18} aria-hidden="true" />{title}</CardTitle>
          {payload ? <span className="text-xs font-semibold text-[var(--color-text-muted)]">Updated {formatObservedAt(payload.forecast.observedAt)}</span> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); setAppliedPostalCode(postalCode.trim()); }}>
          <Input value={postalCode} onChange={(event) => setPostalCode(event.currentTarget.value)} placeholder="Jobsite ZIP code" aria-label="Jobsite ZIP code override" className="min-w-[11rem] flex-1" />
          <Button type="submit" variant="outline" disabled={loading}><RefreshCw size={14} aria-hidden="true" />Update</Button>
        </form>

        {loading ? <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)]" /> : null}
        {!loading && error ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4"><p className="text-sm text-[var(--color-text-secondary)]">{error}</p>{directionsHref ? <a href={directionsHref} target="_blank" rel="noreferrer"><Button size="sm"><Navigation size={14} aria-hidden="true" />Directions</Button></a> : null}</div> : null}

        {!loading && payload ? (
          <>
            <div className="grid gap-3">
              <section data-live-weather data-kind={weatherSceneKind(payload.forecast.current.weatherCode)} data-is-day={payload.forecast.current.isDay} data-paused={!pageVisible} data-compact={compact} className={weatherSceneStyles.panel}>
                <WeatherAtmosphere />
                <div className={weatherSceneStyles.weatherContent}>
                  <div className={weatherSceneStyles.currentConditions}>
                    <div className={weatherSceneStyles.temperatureBlock}>
                      <div className={weatherSceneStyles.liveLabel}><span />Live jobsite weather</div>
                      <p className={weatherSceneStyles.temperature}>{payload.forecast.current.temperatureF}°</p>
                      <p className={weatherSceneStyles.condition}>{payload.forecast.current.condition}</p>
                      <div className={weatherSceneStyles.conditionMetrics}>
                        <span>Feels like <strong>{payload.forecast.current.apparentTemperatureF}°</strong></span>
                        <span>Wind <strong>{payload.forecast.current.windMph} mph</strong></span>
                        <span>Rain <strong>{payload.forecast.hours[0]?.precipitationProbability ?? 0}%</strong></span>
                      </div>
                    </div>
                    <div className={weatherSceneStyles.locationBlock}>
                      <p className={weatherSceneStyles.localTime}>{clock ? formatWeatherDate(clock) : formatWeatherDate(new Date(payload.forecast.observedAt))}<span>{clock ? formatWeatherTime(clock) : formatWeatherTime(new Date(payload.forecast.observedAt))}</span></p>
                      <p className={weatherSceneStyles.location}><MapPin size={15} aria-hidden="true" />{payload.forecast.location}</p>
                      <div className={weatherSceneStyles.modeSwitch} aria-label="Forecast view">
                        <button type="button" onClick={() => setForecastMode("hourly")} data-active={forecastMode === "hourly"}>Hourly</button>
                        <button type="button" onClick={() => setForecastMode("daily")} data-active={forecastMode === "daily"}>7-Day</button>
                      </div>
                    </div>
                  </div>
                  <div className={weatherSceneStyles.forecastRail} data-mode={forecastMode}>
                    {forecastMode === "hourly" ? payload.forecast.hours.slice(0, 6).map((hour, index) => (
                      <article key={hour.time} className={weatherSceneStyles.forecastItem} title={`${hour.condition}; wind ${hour.windMph} mph`}>
                        <p>{index === 0 ? "Now" : formatHour(hour.time)}</p>
                        <WeatherGlyph code={hour.weatherCode} size={24} className={weatherSceneStyles.forecastGlyph} />
                        <strong>{hour.temperatureF}°</strong>
                        <span>{hour.precipitationProbability}%</span>
                      </article>
                    )) : payload.forecast.days.map((day) => (
                      <article key={day.date} className={weatherSceneStyles.forecastItem}>
                        <p>{formatDay(day.date)}</p>
                        <WeatherGlyph code={day.weatherCode} size={24} className={weatherSceneStyles.forecastGlyph} />
                        <strong>{day.highF}°</strong>
                        <span>{day.lowF}° · {day.precipitationProbability}%</span>
                      </article>
                    ))}
                  </div>
                </div>
              </section>

              {showMap && mapEmbed ? (
                <section className="relative h-44 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] shadow-[var(--shadow-small)]">
                  <iframe title={`Map of ${payload.directionsAddress}`} src={mapEmbed} className="absolute inset-0 h-full w-full" loading="lazy" />
                  <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-lg border border-white/50 bg-slate-950/75 px-2.5 py-2 text-white shadow-lg backdrop-blur-md">
                    <p className="min-w-0 truncate text-[10px] font-semibold"><MapPin size={11} className="mr-1 inline" aria-hidden="true" />{directionsAddress}</p>
                    <div className="flex shrink-0 gap-1">
                      {directionsHref ? <a href={directionsHref} target="_blank" rel="noreferrer"><Button size="sm" className="h-7 bg-blue-600 px-2 text-[10px] text-white hover:bg-blue-500"><Navigation size={11} aria-hidden="true" />Go</Button></a> : null}
                      {mapHref ? <a href={mapHref} target="_blank" rel="noreferrer"><Button size="sm" className="h-7 border border-white/20 bg-white/10 px-2 text-[10px] text-white hover:bg-white/20"><ExternalLink size={11} aria-hidden="true" /></Button></a> : null}
                    </div>
                  </div>
                </section>
              ) : null}
              </div>
            <p className="text-[11px] text-[var(--color-text-muted)]">{payload.forecast.attribution}</p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${date}T12:00:00`));
}

function formatHour(time: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(new Date(time));
}

function formatObservedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatWeatherDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(value);
}

function formatWeatherTime(value: Date) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(value);
}

function WeatherGlyph({ code, size, className }: { code: number; size: number; className?: string }) {
  const props = { size, className, "aria-hidden": true as const };
  if (code === 0) return <Sun {...props} className={`${className || ""} text-amber-100`} />;
  if (code <= 3) return <CloudSun {...props} className={`${className || ""} text-amber-50`} />;
  if (code === 45 || code === 48) return <CloudFog {...props} className={`${className || ""} text-slate-100`} />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain {...props} className={`${className || ""} text-cyan-100`} />;
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return <CloudSnow {...props} className={`${className || ""} text-white`} />;
  if (code >= 95) return <CloudLightning {...props} className={`${className || ""} text-yellow-200`} />;
  return <Cloud {...props} className={`${className || ""} text-slate-100`} />;
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
