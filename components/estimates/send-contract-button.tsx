"use client";
import { useState } from "react";
import { Button } from "@/components/ui";

export function SendContractButton({ estimateId }: { estimateId: string }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null); const [contractUrl, setContractUrl] = useState<string | null>(null);
  async function send() { setBusy(true); setMessage(null); try { const response = await fetch(`/api/estimates/${estimateId}/contract`, { method: "POST" }); const body = await response.json(); if (body.url) setContractUrl(body.url); if (!response.ok) throw new Error(body.error); setMessage("Estimate sent."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to send estimate."); } finally { setBusy(false); } }
  return <span className="inline-flex flex-col items-end gap-1"><Button type="button" variant="secondary" size="md" isLoading={busy} onClick={() => void send()} data-orion-action="estimate.send-contract">Send Estimate</Button>{message ? <span className="max-w-64 text-right text-xs text-[var(--color-text-secondary)]" role="status">{message}</span> : null}{contractUrl ? <a className="text-xs font-semibold text-blue-700 underline" href={contractUrl} target="_blank" rel="noreferrer">Open contract link</a> : null}</span>;
}
