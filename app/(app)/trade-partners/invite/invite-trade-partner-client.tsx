"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type VendorOption = { id: string; name: string };

type InviteResponse = {
  ok?: boolean;
  message?: unknown;
  error?: unknown;
};

function readableError(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized && normalized !== "{}" && normalized !== "[object Object]") return normalized;
    return fallback;
  }
  if (value instanceof Error && value.message.trim()) return value.message.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["message", "error", "msg", "detail", "details", "description"]) {
      const nested = readableError(record[key], "");
      if (nested) return nested;
    }
  }
  return fallback;
}

async function readInviteResponse(response: Response): Promise<InviteResponse> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" ? parsed as InviteResponse : { message: parsed };
  } catch {
    return { error: text };
  }
}

export function InviteTradePartnerClient() {
  const supabase = useMemo(() => createClient(), []);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [vendorsError, setVendorsError] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    const loadVendors = async () => {
      setVendorsLoading(true);
      setVendorsError("");

      if (!supabase) {
        if (active) {
          setVendorsError("Unable to connect right now. Please try again shortly.");
          setVendorsLoading(false);
        }
        return;
      }

      try {
        const workspace = await resolveWorkspaceContext(supabase);
        if (!workspace.context) {
          if (active) setVendorsError(workspace.errorMessage || "Unable to verify your workspace.");
          return;
        }

        const { data, error } = await supabase
          .from("vendors")
          .select("id,display_name,company_name,status")
          .eq("company_id", workspace.context.companyId)
          .order("display_name", { ascending: true });

        if (error) {
          if (active) setVendorsError(error.message);
          return;
        }
        if (!active) return;

        const mapped = (data ?? [])
          .filter((vendor) => vendor.status !== "inactive")
          .map((vendor) => ({
            id: vendor.id,
            name: vendor.display_name || vendor.company_name || "Unnamed vendor",
          }));

        setVendors(mapped);
        setVendorId((current) => current || mapped[0]?.id || "");
      } catch (error) {
        if (active) setVendorsError(error instanceof Error ? error.message : "Unable to load vendors.");
      } finally {
        if (active) setVendorsLoading(false);
      }
    };

    void loadVendors();
    return () => {
      active = false;
    };
  }, [supabase]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setSuccess(false);

    try {
      const response = await fetch("/api/trade-partners/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, email, firstName, lastName }),
      });
      const body = await readInviteResponse(response);
      if (!response.ok) {
        throw new Error(readableError(body.error ?? body.message, "Unable to send the Trade Partner invitation. Check the authentication email provider and try again."));
      }
      setSuccess(true);
      setMessage(readableError(body.message, "Trade Partner invitation sent."));
      setEmail("");
      setFirstName("");
      setLastName("");
    } catch (error) {
      setMessage(readableError(error, "Unable to send the Trade Partner invitation. Check the authentication email provider and try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)] sm:p-6">
      {vendorsLoading ? (
        <div className="rounded-xl border border-[var(--bos-border-default)] p-6 text-center text-sm text-[var(--bos-text-secondary)]">Loading vendors…</div>
      ) : vendorsError ? (
        <div className="rounded-xl border border-red-300/40 bg-red-50 p-4 text-sm text-red-900">Unable to load vendors: {vendorsError}</div>
      ) : vendors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--bos-border-default)] p-6 text-center">
          <h2 className="font-semibold">Create a vendor first</h2>
          <p className="mt-2 text-sm text-[var(--bos-text-secondary)]">A Trade Partner login must be linked to an existing B.O.S. vendor record.</p>
          <Link href="/vendors/new" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Add Vendor</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <label className="block space-y-2 text-sm font-semibold">
            Trade Partner / Vendor
            <select value={vendorId} onChange={(event) => setVendorId(event.target.value)} required className="h-11 w-full rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3">
              {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-semibold">First Name<Input value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
            <label className="block space-y-2 text-sm font-semibold">Last Name<Input value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
          </div>

          <label className="block space-y-2 text-sm font-semibold">Email Address<Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>

          <div className="rounded-xl border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-root)] p-4 text-sm leading-6 text-[var(--bos-text-secondary)]">
            B.O.S. will create a restricted subcontractor account linked to this vendor and email an invitation. The invited user will create their password, then enter the Trade Partner portal. Project access still requires an active project assignment for this vendor.
          </div>

          {message ? <div role="status" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${success ? "border-emerald-300/40 bg-emerald-50 text-emerald-800" : "border-red-300/40 bg-red-50 text-red-900"}`}>{message}</div> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Link href="/trade-partners" className="inline-flex h-10 items-center rounded-lg border border-[var(--bos-border-default)] px-4 text-sm font-semibold">Back</Link>
            <Button type="submit" disabled={busy || !vendorId}>{busy ? "Sending invitation…" : "Send Trade Partner Invitation"}</Button>
          </div>
        </form>
      )}
    </section>
  );
}
