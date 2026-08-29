"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, PageHeader, SkeletonLoader, StatusBadge } from "@/components/ui";
import { createProcurementService } from "@/lib/materials/procurement-service";
import type { ProcurementVendorSummary } from "@/lib/materials/procurement-types";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { VendorRow } from "@/lib/vendors";

export function VendorDetailClient() {
  const params = useParams<{ id?: string | string[] }>();
  const vendorId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const supabase = useMemo(() => createClient(), []);
  const procurementService = useMemo(() => createProcurementService(), []);

  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [procurement, setProcurement] = useState<ProcurementVendorSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

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

        try {
          const summary = await procurementService.getVendorSummary(data.id);
          if (active) {
            setProcurement(summary);
          }
        } catch {
          if (active) {
            setProcurement(null);
          }
        }
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
  }, [procurementService, supabase, vendorId]);

  const sendTradePartnerInvite = async () => {
    if (!vendor?.email?.trim()) {
      setInviteError("Add an email address to this vendor before sending B.O.S. access.");
      return;
    }

    setInviteLoading(true);
    setInviteError(null);
    setInviteMessage(null);

    try {
      const response = await fetch("/api/trade-partners/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: vendor.id,
          email: vendor.email.trim(),
          firstName: vendor.first_name || undefined,
          lastName: vendor.last_name || undefined,
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string; invited?: boolean; linked?: boolean } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to send Trade Partner invitation.");
      }

      if (payload?.invited) {
        setInviteMessage(`Invitation sent to ${vendor.email.trim()}. They can activate B.O.S. and continue directly to Trade Partner onboarding.`);
      } else if (payload?.linked) {
        setInviteMessage(`${vendor.email.trim()} already has a B.O.S. account. Trade Partner access is now linked to this vendor profile.`);
      } else {
        setInviteMessage("Trade Partner access is ready for this vendor.");
      }
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Unable to send Trade Partner invitation.");
    } finally {
      setInviteLoading(false);
    }
  };

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
      <PageHeader
        eyebrow="COMPANY WORKSPACE"
        title={vendor.display_name}
        description="Review vendor profile, commercial terms, procurement performance, and B.O.S. Trade Partner access in one workspace."
        secondaryActions={(
          <Link
            href="/vendors"
            className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-4 text-sm font-semibold text-[var(--color-text-secondary)]"
          >
            Back to Vendors
          </Link>
        )}
        primaryAction={(
          <Link href={`/vendors/${vendor.id}/edit`} className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]">
            Edit Vendor
          </Link>
        )}
      />

      <div className="space-y-2">
        <p className="text-sm text-[var(--color-text-secondary)]">{vendor.company_name}</p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={vendor.status} />
          {vendor.preferred_vendor ? (
            <Badge tone="warning" className="inline-flex items-center gap-1"><Star size={12} className="fill-amber-400 text-amber-500" /> Preferred</Badge>
          ) : null}
        </div>
      </div>

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
          <CardHeader><CardTitle>Trade Partner Access</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-[var(--color-text-secondary)]">
            <p>
              Send this company a secure B.O.S. setup link. Their account will be linked to this vendor profile and routed directly into Trade Partner onboarding.
            </p>
            <InfoRow label="Invitation email" value={vendor.email} />
            {inviteError ? (
              <div role="alert" className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-3 py-2 text-[var(--color-danger-700)]">
                {inviteError}
              </div>
            ) : null}
            {inviteMessage ? (
              <div role="status" className="rounded-[var(--radius-md)] border border-[var(--color-success-200)] bg-[var(--color-success-50)] px-3 py-2 text-[var(--color-success-700)]">
                {inviteMessage}
              </div>
            ) : null}
            <Button type="button" onClick={() => void sendTradePartnerInvite()} disabled={inviteLoading || !vendor.email?.trim()}>
              {inviteLoading ? "Sending invitation…" : "Send B.O.S. Trade Partner Invite"}
            </Button>
            {!vendor.email?.trim() ? (
              <p className="text-xs text-[var(--color-text-muted)]">Add the Trade Partner email in Edit Vendor before sending access.</p>
            ) : null}
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

        <Card>
          <CardHeader><CardTitle>Procurement</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--color-text-secondary)]">
            <InfoRow label="Active purchase orders" value={procurement ? String(procurement.activePurchaseOrders) : "-"} />
            <InfoRow label="Order history" value={procurement ? String(procurement.orderHistoryCount) : "-"} />
            <InfoRow label="Delivery performance" value={procurement ? `${procurement.deliveryPerformancePercent}%` : "-"} />
            <InfoRow label="Outstanding balances" value={procurement ? `$${procurement.outstandingBalanceAmount.toFixed(2)}` : "-"} />
            <div>
              <p className="text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">Associated projects</p>
              {procurement && procurement.associatedProjects.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {procurement.associatedProjects.slice(0, 6).map((project) => (
                    <Link key={project.id} href={`/projects/${project.id}`} className="inline-flex rounded-full border border-[var(--color-border-subtle)] px-2.5 py-1 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]">
                      {project.name}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-0.5 text-sm text-[var(--color-text-primary)]">-</p>
              )}
            </div>
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