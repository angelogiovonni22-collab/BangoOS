"use client";

import dynamic from "next/dynamic";

const BusinessGraphPrototypePreview = dynamic(
  () => import("@/components/business-graph/three-prototype").then((module) => module.BusinessGraphPrototypePreview),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-6 shadow-[0_12px_28px_-18px_rgb(15_23_42/0.24)]">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Loading Business Graph prototype preview...</p>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">This isolated route loads the 3D preview client-side so the production graph remains unchanged.</p>
      </div>
    ),
  },
);

export default function BusinessGraphPrototypePage() {
  return <BusinessGraphPrototypePreview />;
}