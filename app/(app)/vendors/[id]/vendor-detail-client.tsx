"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, SkeletonLoader, StatusBadge } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { VendorRow } from "@/lib/vendors";

export function VendorDetailClient() {
  const params = useParams<{ id?: string | string[] }>();
  const vendorId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const supabase = useMemo(() => createClient(), []);

  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setNotFound(false);

      if (!supabase) {
        if (active) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
          setIsLoading(false);
        }

        return;
      }

      if (!vendorId) {
        if (active) {
          setErrorMessage("Unable to read vendor id.");
          setIsLoading(false);
        }

        return;
      }

      try {
        const workspace = await resolveWorkspaceContext(supabase);

        if (!workspace.context) {
          if (active) {
            setErrorMessage(workspace.errorMessage || "Unable to verify your workspace.");
            setIsLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("vendors")
          .select("*")
          .eq("id", vendorId)
          .eq("company_id", workspace.context.companyId)
          .maybeSingle<VendorRow>();

        if (!active) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          setIsLoading(false);
          return;
        }

        if (!data) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        setVendor(data);
      } catch (error) {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load vendor.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [supabase, vendorId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader className="h-8 w-80" />
        <SkeletonLoader className="h-24 w-full" />
        <SkeletonLoader className="h-64 w-full" />
      </div>
    );
  }

  if (errorMessage) {
    return <ErrorState title="Unable to load vendor" description={errorMessage} />;
  }

  if (notFound || !vendor) {
    return (
      <EmptyState
        title="Vendor not found"
        description="This vendor could not be located in your company workspace."
        action={<Link href="/vendors"><Badge tone="brand">Back to vendors</Badge></Link>}
      />
    );
  }

  const contactName = [vendor.first_name, vendor.last_name].filter(Boolean).join(" ") || "Not set";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
        <Link href="/vendors" className="text-[var(--color-brand-700)] transition hover:text-[var(--color-brand-800)]">Vendors</Link>
        <span>/</span>
        <span>{vendor.display_name}</span>
      </div>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-medium)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{vendor.display_name}</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{vendor.company_name}</p>
            <div className="mt-3 flex items-center gap-2">
              <StatusBadge status={vendor.status} />
              {vendor.preferred_vendor ? (
                <Badge tone="warning" className="inline-flex items-center gap-1"><Star size={12} className="fill-amber-400 text-amber-500" /> Preferred</Badge>
              ) : null}
            </div>
          </div>

          <Link href={`/vendors/${vendor.id}/edit`} className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]">
            Edit Vendor
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Business</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Vendor code" value={vendor.vendor_code} />
            <InfoRow label="Website" value={vendor.website} />
            <InfoRow label="Tax ID" value={vendor.tax_id} />
            <InfoRow label="Account number" value={vendor.account_number} />
            <InfoRow label="Payment terms" value={vendor.payment_terms} />
            <InfoRow label="Credit limit" value={vendor.credit_limit !== null ? `$${vendor.credit_limit.toFixed(2)}` : null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Address</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Billing" value={vendor.billing_address} />
            <InfoRow label="Shipping" value={vendor.shipping_address} />
            <InfoRow label="City" value={vendor.city} />
            <InfoRow label="State" value={vendor.state} />
            <InfoRow label="Postal code" value={vendor.postal_code} />
            <InfoRow label="Country" value={vendor.country} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Primary Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Name" value={contactName} />
            <InfoRow label="Title" value={vendor.title} />
            <InfoRow label="Email" value={vendor.email} />
            <InfoRow label="Phone" value={vendor.phone} />
            <InfoRow label="Mobile" value={vendor.mobile} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Performance</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Quality rating" value={vendor.quality_rating !== null ? vendor.quality_rating.toFixed(1) : null} />
            <InfoRow label="Delivery rating" value={vendor.delivery_rating !== null ? vendor.delivery_rating.toFixed(1) : null} />
            <InfoRow label="Notes" value={vendor.notes} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--color-text-primary)]">{value?.trim() || "-"}</p>
    </div>
  );
}
