"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, ErrorState, PageHeader, SkeletonLoader } from "@/components/ui";
import { EstimateStatusBadge, formatEstimateStatusLabel } from "@/components/estimates/estimate-status";
import { formatEstimateDate } from "@/lib/estimates";
import { formatUsd } from "@/lib/estimates/calculations";
import { archiveEstimate, duplicateEstimate, getCustomerDisplayName, getProjectDisplayName, loadEstimateById, loadEstimateFormOptions } from "@/lib/estimates/service";
import type { EstimateLineItemRow, EstimateRow } from "@/lib/estimates/types";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";
import { SendContractButton } from "@/components/estimates/send-contract-button";
import { BlueprintSourceLink } from "@/components/plans/blueprint-source-link";

export function EstimateDetail({ estimateId, sendIssue, createdForReview = false }: { estimateId: string; sendIssue?: string; createdForReview?: boolean }) {
  const { locale } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const [estimate, setEstimate] = useState<EstimateRow | null>(null);
  const [lineItems, setLineItems] = useState<EstimateLineItemRow[]>([]);
  const [customerName, setCustomerName] = useState("Not linked");
  const [projectName, setProjectName] = useState("Not linked");

  useEffect(() => {
    let isSubscribed = true;

    const load = async () => {
      if (!supabase) {
        if (isSubscribed) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        if (isSubscribed) {
          setErrorMessage(workspace.errorMessage || "Unable to resolve workspace.");
          setIsLoading(false);
        }
        return;
      }

      const estimateResult = await loadEstimateById(supabase, workspace.context.companyId, estimateId);

      if (estimateResult.error || !estimateResult.data) {
        if (isSubscribed) {
          setErrorMessage(estimateResult.error || "Estimate not found.");
          setIsLoading(false);
        }
        return;
      }

      const optionsResult = await loadEstimateFormOptions(supabase, workspace.context.companyId);

      if (isSubscribed) {
        setCompanyId(workspace.context.companyId);
        setUserId(workspace.context.userId);
        setEstimate(estimateResult.data.estimate);
        setLineItems(estimateResult.data.lineItems);

        if (optionsResult.data) {
          const customer = optionsResult.data.customers.find((row) => row.id === estimateResult.data?.estimate.customer_id);
          const project = optionsResult.data.projects.find((row) => row.id === estimateResult.data?.estimate.project_id);

          setCustomerName(customer ? getCustomerDisplayName(customer) : "Not linked");
          setProjectName(project ? getProjectDisplayName(project) : "Not linked");
        }

        setIsLoading(false);
      }
    };

    void load();

    return () => {
      isSubscribed = false;
    };
  }, [supabase, estimateId]);

  async function handleDuplicate() {
    if (!supabase || !companyId || !userId) {
      return;
    }

    const result = await duplicateEstimate({
      supabase,
      companyId,
      userId,
      estimateId,
    });

    if (!result.error && result.duplicatedId) {
      router.push(`/estimates/${result.duplicatedId}/edit`);
      router.refresh();
    }
  }

  async function handleArchive() {
    if (!supabase || !companyId || !userId) {
      return;
    }

    const result = await archiveEstimate({
      supabase,
      companyId,
      estimateId,
      userId,
    });

    if (!result.error) {
      router.refresh();
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader className="h-12 w-96" />
        <SkeletonLoader className="h-44 w-full" />
        <SkeletonLoader className="h-64 w-full" />
      </div>
    );
  }

  if (errorMessage || !estimate) {
    return <ErrorState title="Unable to load estimate" description={errorMessage || "Estimate not found."} />;
  }

  return (
    <div className="space-y-6">
      {createdForReview ? (
        <div role="status" data-orion-status="estimate-created-for-review" className="rounded-[var(--radius-md)] border border-[var(--color-success-200)] bg-[var(--color-success-50)] px-4 py-3 text-sm text-[var(--color-success-700)]">
          <span className="font-semibold">Estimate created.</span> Complete the Ohio home-solicitation review below, then send the estimate.
        </div>
      ) : null}
      {sendIssue ? (
        <div role="alert" data-orion-status="estimate-send-error" className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-700)]">
          <span className="font-semibold">Estimate saved, but not sent.</span> {sendIssue}
        </div>
      ) : null}
      <PageHeader
        eyebrow="COMPANY WORKSPACE"
        title={`${estimate.estimate_number || "Unassigned"} · ${estimate.title}`}
        description="Review estimate scope, pricing, and terms in a read-only summary."
        secondaryActions={(
          <>
            {estimate.status !== "approved" && estimate.status !== "archived" ? <SendContractButton estimateId={estimate.id} /> : null}
            {estimate.status === "approved" ? (
              <>
                <Link href={`/change-orders/new?estimateId=${estimate.id}${estimate.customer_id ? `&customerId=${estimate.customer_id}` : ""}${estimate.project_id ? `&projectId=${estimate.project_id}` : ""}`}>
                  <Button type="button" variant="secondary" size="md">Create Change Order</Button>
                </Link>
                <Link href={`/invoices/new?estimateId=${estimate.id}${estimate.customer_id ? `&customerId=${estimate.customer_id}` : ""}${estimate.project_id ? `&projectId=${estimate.project_id}` : ""}`}>
                  <Button type="button" variant="secondary" size="md">Create Invoice</Button>
                </Link>
              </>
            ) : null}
            <Button type="button" variant="secondary" size="md" onClick={handleDuplicate}>Duplicate</Button>
            <Button type="button" variant="secondary" size="md" onClick={handleArchive} disabled={estimate.status === "archived"}>Archive</Button>
          </>
        )}
        primaryAction={(
          <Link href={`/estimates/${estimateId}/edit`} className={getButtonClassName({ size: "md" })}>Edit Estimate</Link>
        )}
      />

      <BlueprintSourceLink targetType="estimate_line_item" targetIds={lineItems.map((item) => item.id)} />

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Estimate Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <DetailRow label="Status" value={<EstimateStatusBadge status={estimate.status} label={formatEstimateStatusLabel(estimate.status)} />} />
          <DetailRow label="Customer" value={customerName} />
          <DetailRow label="Project" value={projectName} />
          <DetailRow label="Total" value={formatUsd(estimate.total_amount ?? 0, localeTag)} />
          <DetailRow label="Estimate Date" value={formatEstimateDate(estimate.issue_date, localeTag, "Not set")} />
          <DetailRow label="Expiration Date" value={formatEstimateDate(estimate.expiration_date, localeTag, "Not set")} />
          <DetailRow label="Prepared By" value={estimate.prepared_by || "Unassigned"} />
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Scope Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{estimate.description || "No scope summary provided."}</p>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-[980px] w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Quantity</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Unit Cost</th>
                <th className="px-3 py-2">Markup</th>
                <th className="px-3 py-2">Unit Price</th>
                <th className="px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((lineItem) => (
                <tr key={lineItem.id} className="border-t border-[var(--color-border-subtle)]">
                  <td className="px-3 py-2 text-sm text-[var(--color-text-primary)]">{formatEstimateStatusLabel(lineItem.category)}</td>
                  <td className="px-3 py-2 text-sm text-[var(--color-text-primary)]">{lineItem.description}</td>
                  <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{lineItem.quantity}</td>
                  <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{formatEstimateStatusLabel(lineItem.unit)}</td>
                  <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{formatUsd(lineItem.unit_cost, localeTag)}</td>
                  <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{lineItem.markup_percent}%</td>
                  <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{formatUsd(lineItem.unit_price, localeTag)}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]">{formatUsd(lineItem.line_total, localeTag)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Pricing Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <DetailRow label="Direct Cost Subtotal" value={formatUsd(estimate.direct_cost_subtotal ?? 0, localeTag)} />
          <DetailRow label="Line-item Markup" value={formatUsd(estimate.markup_total ?? 0, localeTag)} />
          <DetailRow label="Estimate Subtotal" value={formatUsd(estimate.subtotal ?? 0, localeTag)} />
          <DetailRow label="Discount" value={formatUsd(estimate.discount_total ?? 0, localeTag)} />
          <DetailRow label="Tax" value={formatUsd(estimate.tax_amount ?? 0, localeTag)} />
          <DetailRow label="Additional Fee" value={formatUsd(estimate.additional_fee ?? 0, localeTag)} />
          <DetailRow label="Grand Total" value={formatUsd(estimate.total_amount ?? 0, localeTag)} />
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Notes and Terms</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <NoteBlock title="Internal Notes" content={estimate.internal_notes} tone="internal" />
          <NoteBlock title="Customer Notes" content={estimate.customer_notes} />
          <NoteBlock title="Scope Inclusions" content={estimate.scope_inclusions} />
          <NoteBlock title="Scope Exclusions" content={estimate.scope_exclusions} />
          <NoteBlock title="Terms and Conditions" content={estimate.terms} className="md:col-span-2" />
          <NoteBlock title="Payment Terms" content={estimate.payment_terms} className="md:col-span-2" />
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Contract and Signature</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <DetailRow label="Contract status" value={estimate.conversion_state === "converted" ? "Verified · Project created" : estimate.approval_signature_id && estimate.status === "approved" ? "Verified" : estimate.approval_signature_id ? "Signed · Awaiting email verification" : estimate.public_token_last_issued_at ? "Sent · Awaiting signature" : "Not sent"} />
          <DetailRow label="Signed artifact" value={estimate.agreement_hash ? `Recorded · ${estimate.agreement_hash.slice(0, 12)}…` : "Not available"} />
          <DetailRow label="Project conversion" value={estimate.converted_project_id ? <Link className="font-semibold text-blue-700 underline" href={`/projects/${estimate.converted_project_id}`}>Open created project</Link> : "Waiting for verified contract"} />
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-secondary)]">Status history and estimate activity timeline will be expanded in a future sprint.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">{label}</p>
      <div className="mt-1 text-sm text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}

function NoteBlock({
  title,
  content,
  tone,
  className,
}: {
  title: string;
  content: string | null;
  tone?: "internal";
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">{title}</p>
      <div className={[
        "mt-1 rounded-[var(--radius-control)] border px-3 py-2 text-sm whitespace-pre-wrap",
        tone === "internal"
          ? "border-[var(--color-warning-300)] bg-[var(--color-warning-50)] text-[var(--color-warning-800)]"
          : "border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]",
      ].join(" ")}>
        {content || "Not provided."}
      </div>
    </div>
  );
}
