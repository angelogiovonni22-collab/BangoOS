"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "@/components/ui";

type GlobalSearchResult = {
  id: string;
  type: string;
  label: string;
  description: string;
  href: string;
};

export function GlobalSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const open = query.trim().length >= 2;

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as { ok?: boolean; results?: GlobalSearchResult[]; error?: string };
        if (!response.ok || !payload.ok) throw new Error(payload.error || "Search is unavailable.");
        setResults(payload.results || []);
        setActiveIndex(0);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(caught instanceof Error ? caught.message : "Search is unavailable.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setQuery("");
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, []);

  function navigate(result: GlobalSearchResult) {
    setQuery("");
    setResults([]);
    router.push(result.href);
  }

  function updateQuery(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      setActiveIndex(0);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <SearchBar
        value={query}
        placeholder={placeholder}
        aria-label="Search BOS"
        aria-expanded={open}
        aria-controls="bos-global-search-results"
        aria-activedescendant={results[activeIndex] ? `bos-search-${results[activeIndex].type}-${results[activeIndex].id}` : undefined}
        onChange={(event) => updateQuery(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (results.length > 0) setActiveIndex((current) => Math.min(current + 1, results.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter" && results[activeIndex]) {
            event.preventDefault();
            navigate(results[activeIndex]);
          } else if (event.key === "Escape") {
            setQuery("");
          }
        }}
      />

      {open ? (
        <div id="bos-global-search-results" role="listbox" className="absolute right-0 top-[calc(100%+0.5rem)] z-[var(--z-popover)] max-h-[min(28rem,70vh)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--bos-border-default)] bg-[var(--bos-bg-sidebar)] p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)]">
          {loading ? <p className="px-3 py-4 text-sm text-[var(--bos-text-secondary)]">Searching BOS…</p> : null}
          {!loading && error ? <p className="px-3 py-4 text-sm text-red-300">{error}</p> : null}
          {!loading && !error && results.length === 0 ? <p className="px-3 py-4 text-sm text-[var(--bos-text-secondary)]">No matching BOS records or workspaces.</p> : null}
          {!loading && !error ? results.map((result, index) => (
            <button
              id={`bos-search-${result.type}-${result.id}`}
              key={`${result.type}:${result.id}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              className={`block w-full rounded-[var(--radius-lg)] px-3 py-2.5 text-left transition ${index === activeIndex ? "bg-[var(--bos-bg-hover)]" : "hover:bg-[var(--bos-bg-hover)]"}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => navigate(result)}
            >
              <span className="block truncate text-sm font-semibold text-[var(--bos-text-primary)]">{result.label}</span>
              <span className="mt-0.5 block truncate text-xs text-[var(--bos-text-secondary)]">{result.description}</span>
            </button>
          )) : null}
        </div>
      ) : null}
    </div>
  );
}
