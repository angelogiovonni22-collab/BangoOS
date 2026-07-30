"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorState, SkeletonLoader } from "@/components/ui";
import { formatUsd } from "@/lib/change-orders/calculations";
import {
  getCustomerDisplayName,
  getProjectDisplayName,
  loadChangeOrderById,
  loadChangeOrderFormOptions,
} from "@/lib/change-orders/service";
import { formatChangeOrderStatusLabel } from "@/lib/change-orders/statuses";
import type { ChangeOrderLineItemRow, ChangeOrderRow } from "@/lib/change-orders/types";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";

export function ChangeOrderPrintView({ changeOrderId }: { changeOrderId: string }) {
  const { locale } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [changeOrder, setChangeOrder] = useState<ChangeOrderRow | null>(null);
  const [lineItems, setLineItems] = useState<ChangeOrderLineItemRow[]>([]);
  const [customerName, setCustomerName] = useState("Not linked");
  const [projectName, setProjectName] = useState("Not linked");
  const [companyName, setCompanyName] = useState("BangoOS Construction");

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

      const [detailResult, optionsResult, companyResult] = await Promise.all([
        loadChangeOrderById(supabase, workspace.context.companyId, changeOrderId),
        loadChangeOrderFormOptions(supabase, workspace.context.companyId),
        supabase.from("companies").select("name").eq("id", workspace.context.companyId).maybeSingle(),
      ]);

      if (detailResult.error || !detailResult.data) {
        if (isSubscribed) {
          setErrorMessage(detailResult.error || "Change order not found.");
          setIsLoading(false);
        }
        return;
      }

      if (isSubscribed) {
        setChangeOrder(detailResult.data.changeOrder);
        setLineItems(detailResult.data.lineItems);

        if (optionsResult.data) {
          const customer = optionsResult.data.customers.find((row) => row.id === detailResult.data?.changeOrder.customer_id);
          const project = optionsResult.data.projects.find((row) => row.id === detailResult.data?.changeOrder.project_id);

          setCustomerName(customer ? getCustomerDisplayName(customer) : "Not linked");
          setProjectName(project ? getProjectDisplayName(project) : "Not linked");
        }

        if (companyResult.data?.name) {
          setCompanyName(companyResult.data.name);
        }

        setIsLoading(false);
      }
    };

    void load();

    return () => {
      isSubscribed = false;
    };
  }, [supabase, changeOrderId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader className="h-16 w-full" />
        <SkeletonLoader className="h-64 w-full" />
      </div>
    );
  }

  if (errorMessage || !changeOrder) {
    return <ErrorState title="Unable to load print view" description={errorMessage || "Change order not found."} />;
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-8 shadow-[var(--shadow-small)] print:shadow-none print:border-none print:rounded-none print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-[var(--color-border-subtle)] pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Company</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{companyName}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Professional Construction Services</p>
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Change Order</p>
          <h2 className="mt-2 text-xl font-bold text-[var(--color-text-primary)]">{changeOrder.change_order_number}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatChangeOrderStatusLabel(changeOrder.status)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <InfoCard title="Customer" value={customerName} secondary={projectName === "Not linked" ? undefined : `Project: ${projectName}`} />
        <InfoCard title="Requested Date" value={changeOrder.requested_date || "Not set"} />
        <InfoCard title="Effective Date" value={changeOrder.effective_date || "Not set"} />
      </div>

      <section className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Scope Description</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">{changeOrder.description || "No scope description provided."}</p>
      </section>

      <section className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Reason</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">{changeOrder.reason || "No reason provided."}</p>
      </section>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="bg-[var(--color-primary-50)]/50 text-left text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2 text-right">Unit Price</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((lineItem) => (
              <tr key={lineItem.id} className="border-t border-[var(--color-border-subtle)]">
                <td className="px-3 py-2 text-sm text-[var(--color-text-primary)]">{lineItem.description}</td>
                <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{lineItem.quantity}</td>
                <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{lineItem.unit}</td>
                <td className="px-3 py-2 text-right text-sm text-[var(--color-text-secondary)]">{formatUsd(lineItem.unit_price, localeTag)}</td>
                <td className="px-3 py-2 text-right text-sm font-semibold text-[var(--color-text-primary)]">{formatUsd(lineItem.price_amount, localeTag)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Schedule Impact</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">{changeOrder.schedule_impact_days > 0 ? "+" : ""}{changeOrder.schedule_impact_days} days</p>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Customer Notes</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">{changeOrder.customer_notes || "No customer notes provided."}</p>
          </section>
        </div>

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
          <TotalRow label="Subtotal" value={formatUsd(changeOrder.subtotal, localeTag)} />
          <TotalRow label="Tax" value={formatUsd(changeOrder.tax_amount, localeTag)} />
          <TotalRow label="Total" value={formatUsd(changeOrder.total_amount, localeTag)} emphasized />
        </section>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <SignatureBlock title="Customer / Authorized Representative" />
        <SignatureBlock title="Contractor Representative" />
      </section>
    </div>
  );
}

function InfoCard({ title, value, secondary }: { title: string; value: string; secondary?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{title}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
      {secondary ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{secondary}</p> : null}
    </div>
  );
}

function TotalRow({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className={["flex items-center justify-between py-1.5", emphasized ? "border-t border-[var(--color-border-subtle)] mt-1 pt-3" : ""].join(" ")}>
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span className={emphasized ? "text-sm font-bold text-[var(--color-text-primary)]" : "text-sm font-semibold text-[var(--color-text-primary)]"}>{value}</span>
    </div>
  );
}

function SignatureBlock({ title }: { title: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{title}</p>
      <div className="mt-8 border-b border-[var(--color-border-strong)]" />
      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Signature</p>
      <div className="mt-6 border-b border-[var(--color-border-strong)]" />
      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Date</p>
    </div>
  );
}
