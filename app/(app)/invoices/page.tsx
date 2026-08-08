"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, PageHeader } from "@/components/ui";
import { InvoicesDirectory } from "@/components/invoices";
import { loadInvoiceDirectoryData, getCustomerDisplayName, getProjectDisplayName } from "@/lib/invoices/service";
import { normalizeInvoiceStatus } from "@/lib/invoices/statuses";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";

export default function InvoicesPage() {
  const { locale } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [items, setItems] = useState<Array<{
    id: string;
    invoiceNumber: string;
    title: string;
    customerName: string;
    customerId: string | null;
    projectName: string;
    projectId: string | null;
    status: string;
    issueDate: string | null;
    dueDate: string | null;
    totalAmount: number;
    amountPaid: number;
    balanceDue: number;
    updatedAt: string;
  }>>([]);

  const [customerOptions, setCustomerOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [projectOptions, setProjectOptions] = useState<Array<{ value: string; label: string }>>([]);

  const load = useCallback(async () => {
    if (!supabase) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const workspace = await resolveWorkspaceContext(supabase);

    if (workspace.errorMessage || !workspace.context) {
      setErrorMessage(workspace.errorMessage || "Unable to load workspace.");
      setIsLoading(false);
      return;
    }

    const result = await loadInvoiceDirectoryData(supabase, workspace.context.companyId);

    if (result.error || !result.customers || !result.projects || !result.invoices) {
      setErrorMessage(result.error || "Unable to load invoices.");
      setIsLoading(false);
      return;
    }

    const customerMap = new Map(result.customers.map((customer) => [customer.id, getCustomerDisplayName(customer)]));
    const projectMap = new Map(result.projects.map((project) => [project.id, getProjectDisplayName(project)]));
    const now = new Date();

    const directoryItems = result.invoices.map((invoice) => {
      const normalizedStatus = normalizeInvoiceStatus(invoice.status);
      const dueDate = invoice.due_date ? new Date(`${invoice.due_date}T00:00:00`) : null;
      const isOverdue = normalizedStatus !== "paid" && normalizedStatus !== "void" && dueDate && dueDate < now;

      const status = isOverdue ? "overdue" : normalizedStatus;
      const balanceDue = Math.max((invoice.total_amount || 0) - (invoice.amount_paid || 0), 0);

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number || "Unassigned",
        title: invoice.title,
        customerName: invoice.customer_id ? customerMap.get(invoice.customer_id) || "Not linked" : "Not linked",
        customerId: invoice.customer_id,
        projectName: invoice.project_id ? projectMap.get(invoice.project_id) || "Not linked" : "Not linked",
        projectId: invoice.project_id,
        status,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        totalAmount: invoice.total_amount || 0,
        amountPaid: invoice.amount_paid || 0,
        balanceDue,
        updatedAt: invoice.updated_at,
      };
    });

    setItems(directoryItems);
    setCustomerOptions(result.customers.map((customer) => ({ value: customer.id, label: getCustomerDisplayName(customer) })));
    setProjectOptions(result.projects.map((project) => ({ value: project.id, label: getProjectDisplayName(project) })));
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        compact
        eyebrow="COMPANY WORKSPACE"
        title="Invoices"
        description="Create, issue, and track customer invoices and payments."
        primaryAction={(
          <Link href="/invoices/new">
            <Button size="md">New Invoice</Button>
          </Link>
        )}
      />

      <InvoicesDirectory
        items={items}
        customerOptions={customerOptions}
        projectOptions={projectOptions}
        localeTag={localeTag}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />
    </div>
  );
}
