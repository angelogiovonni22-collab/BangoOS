"use client";

import { useEffect, useMemo, useState } from "react";
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, ExternalLink, MapPin, Navigation, RefreshCw, Sun } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import type { LocationForecast } from "@/lib/location-intelligence";

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

  useEffect(() => {
    const updateClock = () => setClock(new Date());
    updateClock();
    const timer = window.setInterval(updateClock, 30_000);
    return () => window.clearInterval(timer);
  }, []);

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
  }, [appliedPostalCode, projectId]);

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
      <CardContent className="space-y-4 p-5">
        <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); setAppliedPostalCode(postalCode.trim()); }}>
          <Input value={postalCode} onChange={(event) => setPostalCode(event.currentTarget.value)} placeholder="Jobsite ZIP code" aria-label="Jobsite ZIP code override" className="min-w-[11rem] flex-1" />
          <Button type="submit" variant="outline" disabled={loading}><RefreshCw size={14} aria-hidden="true" />Update</Button>
        </form>

        {loading ? <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)]" /> : null}
        {!loading && error ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4"><p className="text-sm text-[var(--color-text-secondary)]">{error}</p>{directionsHref ? <a href={directionsHref} target="_blank" rel="noreferrer"><Button size="sm"><Navigation size={14} aria-hidden="true" />Directions</Button></a> : null}</div> : null}

        {!loading && payload ? (
          <>
            <div className="overflow-hidden rounded-[var(--radius-xl)] border border-cyan-300/20 bg-gradient-to-br from-[#087c9d] via-[#075f83] to-[#07335f] text-white shadow-[0_18px_45px_rgba(3,55,89,0.24)]">
              <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:p-6">
                <div className="flex min-w-0 items-center gap-4 sm:gap-6">
                  <div className="grid size-24 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_38%_32%,#fff7b2_0%,#ffd34f_34%,#ff9e2c_70%,rgba(255,158,44,0.08)_72%)] shadow-[0_0_36px_rgba(255,205,72,0.55)] sm:size-32">
                    <WeatherGlyph code={payload.forecast.current.weatherCode} size={62} className="drop-shadow-lg sm:size-[78px]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-5xl font-light leading-none tracking-[-0.05em] sm:text-6xl">{payload.forecast.current.temperatureF}°</p>
                    <p className="mt-2 text-lg font-semibold">{payload.forecast.current.condition}</p>
                    <p className="mt-1 text-sm text-cyan-50/80">Feels like {payload.forecast.current.apparentTemperatureF}° · Wind {payload.forecast.current.windMph} mph</p>
                  </div>
                </div>
                <div className="flex min-w-[12rem] flex-col justify-between gap-4 text-left sm:items-end sm:text-right">
                  <div>
                    <p className="text-sm font-semibold text-cyan-50/80">{clock ? formatWeatherDate(clock) : formatWeatherDate(new Date(payload.forecast.observedAt))}</p>
                    <p className="mt-1 text-4xl font-light tabular-nums">{clock ? formatWeatherTime(clock) : formatWeatherTime(new Date(payload.forecast.observedAt))}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold sm:justify-end"><MapPin size={14} aria-hidden="true" />{payload.forecast.location}</p>
                    {payload.projectName ? <p className="mt-1 text-xs text-cyan-50/70">{payload.projectName}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {directionsHref ? <a href={directionsHref} target="_blank" rel="noreferrer"><Button size="sm" className="border border-white/20 bg-white/15 text-white hover:bg-white/25"><Navigation size={14} aria-hidden="true" />Directions</Button></a> : null}
                    {mapHref ? <a href={mapHref} target="_blank" rel="noreferrer"><Button size="sm" className="border border-white/20 bg-white/10 text-white hover:bg-white/20">Open Map<ExternalLink size={13} aria-hidden="true" /></Button></a> : null}
                  </div>
                </div>
              </div>
              <div className={`grid border-t border-white/15 bg-[#052f57]/35 ${compact ? "grid-cols-4" : "grid-cols-4 lg:grid-cols-7"}`}>
              {payload.forecast.days.map((day) => (
                <article key={day.date} className="min-w-0 border-r border-white/10 p-3 text-center last:border-r-0 sm:p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.08em] text-cyan-50/75">{formatDay(day.date)}</p>
                  <WeatherGlyph code={day.weatherCode} size={28} className="mx-auto my-2" />
                  <p className="text-sm font-bold">{day.highF}° <span className="font-medium text-cyan-50/65">{day.lowF}°</span></p>
                  <p className="mt-1 truncate text-[11px] text-cyan-50/75">{day.condition}</p>
                  <p className="mt-0.5 text-[10px] text-cyan-50/60">Rain {day.precipitationProbability}%</p>
                </article>
              ))}
              </div>
            </div>

            {showMap && mapEmbed ? (
              <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)]">
                <iframe title={`Map of ${payload.directionsAddress}`} src={mapEmbed} className="h-72 w-full" loading="lazy" />
              </div>
            ) : null}
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
