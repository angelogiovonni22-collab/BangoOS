"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, getButtonClassName } from "@/components/ui";
import { EstimatesDirectory } from "@/components/estimates";
import { loadEstimateDirectoryData, getCustomerDisplayName, getProjectDisplayName } from "@/lib/estimates/service";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";

export default function EstimatesPage() {
  const { locale } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");

  const [items, setItems] = useState<Array<{
    id: string;
    estimateNumber: string;
    title: string;
    customerName: string;
    customerId: string | null;
    projectName: string;
    projectId: string | null;
    status: string;
    issueDate: string | null;
    expirationDate: string | null;
    totalAmount: number;
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

    setCompanyId(workspace.context.companyId);
    setUserId(workspace.context.userId);

    const result = await loadEstimateDirectoryData(supabase, workspace.context.companyId);

    if (result.error || !result.customers || !result.projects || !result.estimates) {
      setErrorMessage(result.error || "Unable to load estimates.");
      setIsLoading(false);
      return;
    }

    const customerMap = new Map(result.customers.map((customer) => [customer.id, getCustomerDisplayName(customer)]));
    const projectMap = new Map(result.projects.map((project) => [project.id, getProjectDisplayName(project)]));

    const directoryItems = result.estimates.map((estimate) => ({
      id: estimate.id,
      estimateNumber: estimate.estimate_number || "Unassigned",
      title: estimate.title,
      customerName: estimate.customer_id ? customerMap.get(estimate.customer_id) || "Not linked" : "Not linked",
      customerId: estimate.customer_id,
      projectName: estimate.project_id ? projectMap.get(estimate.project_id) || "Not linked" : "Not linked",
      projectId: estimate.project_id,
      status: estimate.status,
      issueDate: estimate.issue_date,
      expirationDate: estimate.expiration_date,
      totalAmount: estimate.total_amount || 0,
      updatedAt: estimate.updated_at,
    }));

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
        title="Estimates"
        description="Create, price, send, and track construction estimates."
        primaryAction={(
          <Link href="/estimates/new" className={getButtonClassName({ size: "md" })}>New Estimate</Link>
        )}
      />

      <EstimatesDirectory
        items={items}
        customerOptions={customerOptions}
        projectOptions={projectOptions}
        localeTag={localeTag}
        companyId={companyId}
        userId={userId}
        onMutationComplete={load}
        isLoading={isLoading}
        errorMessage={errorMessage}
      />
    </div>
  );
}
