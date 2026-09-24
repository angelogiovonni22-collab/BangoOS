"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function PreviewEstimateButton({ estimateId }: { estimateId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function preview() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/estimates/${estimateId}/preview`, { method: "POST" });
      const body = await response.json() as { url?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error || "Unable to create customer preview.");
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create customer preview.");
    } finally {
      setBusy(false);
    }
  }

  return <span className="inline-flex flex-col items-end gap-1">
    <Button type="button" variant="secondary" size="md" isLoading={busy} onClick={() => void preview()}>
      Preview as Customer
    </Button>
    {message ? <span className="max-w-64 text-right text-xs text-[var(--color-danger-700)]" role="status">{message}</span> : null}
  </span>;
}
