"use client";

import { useEffect, useState } from "react";
import {
  BANGO_LAYOUT_OPTIONS,
  BANGO_LAYOUT_STORAGE_KEY,
  isBangoLayoutId,
  type BangoLayoutId,
} from "@/lib/layout/layout-options";

function applyLayout(layoutId: BangoLayoutId) {
  document.documentElement.dataset.layout = layoutId;
  window.dispatchEvent(new CustomEvent("bangoos-layout-change", { detail: layoutId }));
}

export function LayoutGallery() {
  const [layoutId, setLayoutId] = useState<BangoLayoutId>("classic-sidebar");

  useEffect(() => {
    const stored = window.localStorage.getItem(BANGO_LAYOUT_STORAGE_KEY);
    const preferred: BangoLayoutId = isBangoLayoutId(stored) ? stored : "classic-sidebar";
    applyLayout(preferred);
    const frame = window.requestAnimationFrame(() => setLayoutId(preferred));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function chooseLayout(nextLayoutId: BangoLayoutId) {
    setLayoutId(nextLayoutId);
    window.localStorage.setItem(BANGO_LAYOUT_STORAGE_KEY, nextLayoutId);
    applyLayout(nextLayoutId);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2" role="radiogroup" aria-label="B.O.S. workspace layout">
      {BANGO_LAYOUT_OPTIONS.map((layout) => {
        const selected = layout.id === layoutId;
        const topCommand = layout.id === "top-command";

        return (
          <button
            key={layout.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => chooseLayout(layout.id)}
            className={`group overflow-hidden rounded-[var(--radius-xl)] border bg-[var(--color-surface-card)] text-left shadow-[var(--shadow-small)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] ${selected ? "border-[var(--color-action-primary)] ring-2 ring-[color:rgb(37_99_235/0.16)]" : "border-[var(--color-border-subtle)] hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-medium)]"}`}
          >
            <div className="relative h-40 overflow-hidden bg-[#06101d]">
              <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(rgba(34,211,238,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,.12) 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
              {topCommand ? (
                <>
                  <div className="absolute inset-x-3 top-3 flex h-10 items-center gap-2 rounded-lg border border-cyan-400/40 bg-[#071522]/95 px-3 shadow-[0_0_24px_rgba(34,211,238,.12)]">
                    <div className="h-6 w-9 rounded bg-cyan-400/80" />
                    {[48, 34, 42, 38, 46, 40].map((width, index) => <div key={index} className="h-2 rounded bg-cyan-100/45" style={{ width }} />)}
                  </div>
                  <div className="absolute left-4 right-4 top-16 grid grid-cols-4 gap-2">
                    {[0,1,2,3].map((item) => <div key={item} className="h-12 rounded-md border border-cyan-400/25 bg-[#0a1928]/95" />)}
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 grid grid-cols-[1.2fr_2fr_1fr] gap-2">
                    {[0,1,2].map((item) => <div key={item} className="h-12 rounded-md border border-cyan-400/20 bg-[#091725]/95" />)}
                  </div>
                </>
              ) : (
                <>
                  <div className="absolute inset-y-3 left-3 w-16 rounded-lg border border-cyan-400/25 bg-[#071522]/95" />
                  <div className="absolute left-24 right-3 top-3 h-10 rounded-lg border border-white/10 bg-[#0a1724]/95" />
                  <div className="absolute bottom-3 left-24 right-3 grid grid-cols-3 gap-2">
                    {[0,1,2].map((item) => <div key={item} className="h-20 rounded-md border border-white/10 bg-[#0a1724]/95" />)}
                  </div>
                </>
              )}
              {selected ? <span className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-black text-slate-900 shadow-md">✓</span> : null}
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-bold text-[var(--color-text-primary)]">{layout.name}</p>
                <span className="rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{layout.badge}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{layout.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
