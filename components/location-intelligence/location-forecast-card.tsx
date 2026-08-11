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
      <CardContent className="space-y-3 p-4">
        <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); setAppliedPostalCode(postalCode.trim()); }}>
          <Input value={postalCode} onChange={(event) => setPostalCode(event.currentTarget.value)} placeholder="Jobsite ZIP code" aria-label="Jobsite ZIP code override" className="min-w-[11rem] flex-1" />
          <Button type="submit" variant="outline" disabled={loading}><RefreshCw size={14} aria-hidden="true" />Update</Button>
        </form>

        {loading ? <div className="h-40 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)]" /> : null}
        {!loading && error ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4"><p className="text-sm text-[var(--color-text-secondary)]">{error}</p>{directionsHref ? <a href={directionsHref} target="_blank" rel="noreferrer"><Button size="sm"><Navigation size={14} aria-hidden="true" />Directions</Button></a> : null}</div> : null}

        {!loading && payload ? (
          <>
            <div className="overflow-hidden rounded-[var(--radius-xl)] border border-cyan-200/20 bg-[radial-gradient(circle_at_18%_-20%,rgba(75,220,255,0.7),transparent_38%),linear-gradient(135deg,#087f9f_0%,#07597d_52%,#062f59_100%)] text-white shadow-[0_14px_34px_rgba(3,45,79,0.25),inset_0_1px_0_rgba(255,255,255,0.22)]">
              <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4 sm:py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <WeatherScene code={payload.forecast.current.weatherCode} />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <p className="text-4xl font-light leading-none tracking-[-0.05em]">{payload.forecast.current.temperatureF}°</p>
                      <p className="truncate text-sm font-semibold">{payload.forecast.current.condition}</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-cyan-50/75">Feels {payload.forecast.current.apparentTemperatureF}° · Wind {payload.forecast.current.windMph} mph</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-left sm:min-w-[19rem] sm:justify-end sm:text-right">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-cyan-50/75">{clock ? formatWeatherDate(clock) : formatWeatherDate(new Date(payload.forecast.observedAt))} · <span className="tabular-nums">{clock ? formatWeatherTime(clock) : formatWeatherTime(new Date(payload.forecast.observedAt))}</span></p>
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold sm:justify-end"><MapPin size={12} aria-hidden="true" />{payload.forecast.location}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {directionsHref ? <a href={directionsHref} target="_blank" rel="noreferrer"><Button size="sm" className="h-8 border border-white/20 bg-white/15 px-2.5 text-xs text-white hover:bg-white/25"><Navigation size={13} aria-hidden="true" />Directions</Button></a> : null}
                    {mapHref ? <a href={mapHref} target="_blank" rel="noreferrer"><Button size="sm" className="h-8 border border-white/20 bg-white/10 px-2.5 text-xs text-white hover:bg-white/20">Map<ExternalLink size={12} aria-hidden="true" /></Button></a> : null}
                  </div>
                </div>
              </div>
              <div className={`grid border-t border-white/15 bg-[#052f57]/35 ${compact ? "grid-cols-4" : "grid-cols-4 lg:grid-cols-7"}`}>
              {payload.forecast.days.map((day) => (
                <article key={day.date} className="min-w-0 border-r border-white/10 px-1.5 py-2 text-center last:border-r-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-cyan-50/75">{formatDay(day.date)}</p>
                  <WeatherGlyph code={day.weatherCode} size={18} className="mx-auto my-1 drop-shadow-md" />
                  <p className="text-xs font-bold">{day.highF}° <span className="font-medium text-cyan-50/65">{day.lowF}°</span></p>
                  <p className="mt-0.5 truncate text-[9px] text-cyan-50/65">{day.precipitationProbability}% rain</p>
                </article>
              ))}
              </div>
            </div>

            {showMap && mapEmbed ? (
              <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)]">
                <iframe title={`Map of ${payload.directionsAddress}`} src={mapEmbed} className="h-40 w-full" loading="lazy" />
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

function WeatherScene({ code }: { code: number }) {
  const isClear = code === 0;
  return (
    <div data-weather-scene className="relative size-16 shrink-0 [perspective:180px]" aria-hidden="true">
      <div className="absolute inset-1 rounded-full bg-black/20 blur-md" />
      <div className={`absolute inset-0 rounded-full blur-lg ${isClear ? "bg-amber-300/35" : "bg-cyan-200/20"}`} />
      <div className={`absolute inset-1 z-10 overflow-hidden rounded-full border border-white/35 shadow-[inset_-9px_-10px_15px_rgba(1,30,58,0.35),inset_7px_7px_12px_rgba(255,255,255,0.38),0_8px_15px_rgba(0,19,42,0.35)] [transform:rotateX(8deg)] ${isClear ? "bg-[radial-gradient(circle_at_32%_26%,#fffbd0_0%,#ffe45c_24%,#ffb52e_58%,#f6781d_100%)]" : "bg-[radial-gradient(circle_at_30%_22%,#dffaff_0%,#68c9e7_35%,#197aa9_72%,#0a456f_100%)]"}`}>
        <span className="absolute left-2 top-1.5 h-4 w-7 rotate-[-24deg] rounded-full bg-white/45 blur-[3px]" />
        {!isClear ? <span className="absolute inset-0 grid place-items-center bg-[linear-gradient(145deg,transparent_34%,rgba(2,34,65,0.22))]"><WeatherGlyph code={code} size={36} className="text-white drop-shadow-[0_5px_4px_rgba(0,20,45,0.5)]" /></span> : null}
      </div>
    </div>
  );
}
