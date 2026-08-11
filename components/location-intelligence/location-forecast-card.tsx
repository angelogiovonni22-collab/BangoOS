"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudSun, ExternalLink, MapPin, Navigation, RefreshCw } from "lucide-react";
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
  title?: string;
  showMap?: boolean;
  compact?: boolean;
};

export function LocationForecastCard({ projectId, title = "Jobsite Weather", showMap = false, compact = false }: LocationForecastCardProps) {
  const [postalCode, setPostalCode] = useState("");
  const [appliedPostalCode, setAppliedPostalCode] = useState("");
  const [payload, setPayload] = useState<ForecastPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  const directionsHref = useMemo(() => payload
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(payload.directionsAddress)}`
    : null, [payload]);
  const mapHref = payload ? `https://www.openstreetmap.org/?mlat=${payload.forecast.latitude}&mlon=${payload.forecast.longitude}#map=15/${payload.forecast.latitude}/${payload.forecast.longitude}` : null;
  const mapEmbed = payload ? openStreetMapEmbed(payload.forecast.latitude, payload.forecast.longitude) : null;

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
        {!loading && error ? <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">{error}</p> : null}

        {!loading && payload ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]"><MapPin size={13} aria-hidden="true" />{payload.projectName || payload.forecast.location}</p>
                <p className="mt-2 text-4xl font-bold text-[var(--color-text-primary)]">{payload.forecast.current.temperatureF}°F</p>
                <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{payload.forecast.current.condition} · Feels like {payload.forecast.current.apparentTemperatureF}°</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Wind {payload.forecast.current.windMph} mph</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {directionsHref ? <a href={directionsHref} target="_blank" rel="noreferrer"><Button size="sm"><Navigation size={14} aria-hidden="true" />Directions</Button></a> : null}
                {mapHref ? <a href={mapHref} target="_blank" rel="noreferrer"><Button size="sm" variant="outline">Open Map<ExternalLink size={13} aria-hidden="true" /></Button></a> : null}
              </div>
            </div>

            <div className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-4 xl:grid-cols-7"}`}>
              {payload.forecast.days.map((day) => (
                <article key={day.date} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3 text-center">
                  <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">{formatDay(day.date)}</p>
                  <p className="mt-1 text-sm font-bold text-[var(--color-text-primary)]">{day.highF}° / {day.lowF}°</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{day.condition}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">Rain {day.precipitationProbability}%</p>
                </article>
              ))}
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

function openStreetMapEmbed(latitude: number, longitude: number) {
  const delta = 0.018;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
}
