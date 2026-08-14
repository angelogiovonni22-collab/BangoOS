"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, PageHeader } from "@/components/ui";
import { ChangeOrdersDirectory } from "@/components/change-orders";
import {
  archiveChangeOrder,
  getCustomerDisplayName,
  getProjectDisplayName,
  loadChangeOrderDirectoryData,
  restoreChangeOrder,
} from "@/lib/change-orders/service";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";

export default function ChangeOrdersPage() {
  const { locale } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");

  const [items, setItems] = useState<Array<{
    id: string;
    changeOrderNumber: string;
    title: string;
    customerName: string;
    customerId: string | null;
    projectName: string;
    projectId: string | null;
    status: string;
    scheduleImpactDays: number;
    totalAmount: number;
    requestedDate: string | null;
    updatedAt: string;
    archivedAt: string | null;
    description: string | null;
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

    const result = await loadChangeOrderDirectoryData(supabase, workspace.context.companyId);

    if (result.error || !result.customers || !result.projects || !result.changeOrders) {
      setErrorMessage(result.error || "Unable to load change orders.");
      setIsLoading(false);
      return;
    }

    const customerMap = new Map(result.customers.map((customer) => [customer.id, getCustomerDisplayName(customer)]));
    const projectMap = new Map(result.projects.map((project) => [project.id, getProjectDisplayName(project)]));

    const directoryItems = result.changeOrders.map((changeOrder) => ({
      id: changeOrder.id,
      changeOrderNumber: changeOrder.change_order_number || "Unassigned",
      title: changeOrder.title,
      customerName: changeOrder.customer_id ? customerMap.get(changeOrder.customer_id) || "Not linked" : "Not linked",
      customerId: changeOrder.customer_id,
      projectName: changeOrder.project_id ? projectMap.get(changeOrder.project_id) || "Not linked" : "Not linked",
      projectId: changeOrder.project_id,
      status: changeOrder.status,
      scheduleImpactDays: changeOrder.schedule_impact_days || 0,
      totalAmount: changeOrder.total_amount || 0,
      requestedDate: changeOrder.requested_date,
      updatedAt: changeOrder.updated_at,
      archivedAt: changeOrder.archived_at,
      description: changeOrder.description,
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

  async function handleArchive(changeOrderId: string) {
    if (!supabase || !companyId || !userId) {
      return;
    }

    const result = await archiveChangeOrder({
      supabase,
      companyId,
      changeOrderId,
      userId,
    });

    if (!result.error) {
      await load();
    }
  }

  async function handleRestore(changeOrderId: string) {
    if (!supabase || !companyId || !userId) {
      return;
    }

    const result = await restoreChangeOrder({
      supabase,
      companyId,
      changeOrderId,
      userId,
    });

    if (!result.error) {
      await load();
    }
  }

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        compact
        eyebrow="COMPANY WORKSPACE"
        title="Change Orders"
        description="Track scope, approvals, schedule impacts, and downstream invoice changes."
        primaryAction={(
          <Link href="/change-orders/new">
            <Button size="md">New Change Order</Button>
          </Link>
        )}
      />

      <ChangeOrdersDirectory
        items={items}
        customerOptions={customerOptions}
        projectOptions={projectOptions}
        localeTag={localeTag}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onArchive={handleArchive}
        onRestore={handleRestore}
      />
    </div>
  );
}
