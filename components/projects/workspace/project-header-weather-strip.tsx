"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CloudSun, MapPin, Navigation } from "lucide-react";

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
    };
    days: Array<{ highF: number; lowF: number }>;
  };
};

export function ProjectHeaderWeatherStrip() {
  const params = useParams<{ id?: string | string[] }>();
  const projectId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [payload, setPayload] = useState<HeaderWeatherPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
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
  }, [projectId]);

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
          <div className="flex items-center gap-4 px-5 py-4">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#4f76a8] bg-[#183960] text-[#dcecff]">
              <CloudSun size={22} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex items-end gap-3">
                <p className="text-[2.4rem] font-light leading-none tracking-[-0.05em] text-white">{payload.forecast.current.temperatureF}°</p>
                <div className="pb-0.5">
                  <p className="text-sm font-bold text-white">{payload.forecast.current.condition}</p>
                  <p className="text-[11px] font-semibold text-[#b9cde8]">Feels like {payload.forecast.current.apparentTemperatureF}° · Wind {payload.forecast.current.windMph} mph</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-[#b9cde8]">
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
