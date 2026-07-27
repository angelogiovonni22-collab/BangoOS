"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { formatProjectDate, normalizeProjectStatus, getProjectDisplayName, type ProjectRow } from "@/lib/projects";
import type { Database } from "@/types/database.types";
import { getProjectStatusBadgeClass } from "@/lib/projects/statuses";
import { useI18n } from "@/lib/i18n/provider";

type CustomerSummaryRow = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "first_name" | "last_name" | "company_name" | "customer_type"
>;

type RecentProjectItem = {
  id: string;
  name: string;
  customerName: string;
  statusLabel: string;
  statusKey: string;
  createdAt: string;
};

export default function RecentProjectsWidget() {
  const { t, locale } = useI18n();
  const supabase = useMemo(() => createClient(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<RecentProjectItem[]>([]);

  useEffect(() => {
    let isSubscribed = true;

    const loadProjects = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        if (isSubscribed) {
          setErrorMessage(workspace.errorMessage);
          setIsLoading(false);
        }

        return;
      }

      const client = supabase;

      if (!client) {
        if (isSubscribed) {
          setErrorMessage(t("projects.errorConnect"));
          setIsLoading(false);
        }

        return;
      }

      try {
        const [projectsResponse, customersResponse] = await Promise.all([
          client
            .from("projects")
            .select("id, customer_id, name, status, created_at")
            .eq("company_id", workspace.context.companyId)
            .order("created_at", { ascending: false })
            .limit(5),
          client
            .from("customers")
            .select("id, first_name, last_name, company_name, customer_type")
            .eq("company_id", workspace.context.companyId),
        ]);

        if (projectsResponse.error) {
          if (isSubscribed) {
            setErrorMessage(t("dashboard.recentProjectsLoadError"));
          }

          return;
        }

        if (customersResponse.error) {
          if (isSubscribed) {
            setErrorMessage(t("dashboard.recentProjectsLoadError"));
          }

          return;
        }

        const customerNameMap = new Map(
          (customersResponse.data ?? []).map((customer) => [
            customer.id,
            getCustomerDisplayName(customer, t("customers.unnamedCustomer")),
          ]),
        );

        const mappedProjects = (projectsResponse.data ?? []).map((row) => {
          const project = row as ProjectRow;
          const status = normalizeProjectStatus(project.status);

          return {
            id: project.id,
            name: getProjectDisplayName(project, t("projects.unnamedProject")),
            customerName: project.customer_id ? customerNameMap.get(project.customer_id) || t("projects.notLinked") : t("projects.notLinked"),
            statusLabel: mapProjectStatus(status.key, t),
            statusKey: status.key,
            createdAt: project.created_at,
          };
        });

        if (isSubscribed) {
          setProjects(mappedProjects);
        }
      } catch (caughtError) {
        console.error("Load recent projects error:", caughtError);

        if (isSubscribed) {
          setErrorMessage(t("projects.errorUnexpectedLoad"));
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    void loadProjects();

    return () => {
      isSubscribed = false;
    };
  }, [supabase, t]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{t("dashboard.recentProjectsTitle")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("dashboard.recentProjectsDescription")}</p>
        </div>

        <Link href="/projects" className="text-sm font-semibold text-blue-600 transition hover:text-blue-800">
          {t("dashboard.viewAll")}
        </Link>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <WidgetLoadingState />
        ) : errorMessage ? (
          <WidgetErrorState message={errorMessage} />
        ) : projects.length > 0 ? (
          <div className="space-y-3">
            {projects.map((project) => (
              <article key={project.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/50">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/projects/${project.id}`} className="font-semibold text-slate-950 transition hover:text-blue-700">
                      {project.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-500">{project.customerName}</p>
                  </div>

                  <ProjectStatusBadge statusKey={project.statusKey} label={project.statusLabel} />
                </div>

                <div className="mt-4 flex items-center justify-between gap-4 text-sm text-slate-600">
                  <span>{formatProjectDate(project.createdAt, locale === "es" ? "es-ES" : "en-US")}</span>
                  <Link href={`/projects/${project.id}`} className="font-semibold text-blue-600 transition hover:text-blue-800">
                    {t("dashboard.link")}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <WidgetEmptyState />
        )}
      </div>
    </section>
  );
}

function WidgetLoadingState() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div>
        <p className="font-semibold text-slate-800">{t("dashboard.loadingRecentProjects")}</p>
        <p className="mt-2 text-sm text-slate-500">{t("dashboard.loadingRecentProjectsDescription")}</p>
      </div>
    </div>
  );
}

function WidgetErrorState({ message }: { message: string }) {
  const { t } = useI18n();

  return (
    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-rose-300 bg-rose-50 p-8 text-center">
      <div>
        <p className="font-semibold text-rose-700">{t("dashboard.recentProjectsLoadError")}</p>
        <p className="mt-2 text-sm text-rose-600">{message}</p>
      </div>
    </div>
  );
}

function WidgetEmptyState() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div>
        <p className="font-semibold text-slate-800">{t("dashboard.recentProjectsEmptyTitle")}</p>
        <p className="mt-2 text-sm text-slate-500">{t("dashboard.recentProjectsEmptyDescription")}</p>
      </div>
    </div>
  );
}

function ProjectStatusBadge({ statusKey, label }: { statusKey: string; label: string }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getProjectStatusBadgeClass(statusKey)}`}>{label}</span>;
}

function getCustomerDisplayName(customer: CustomerSummaryRow, fallbackLabel = "Unnamed Customer") {
  const companyName = customer.company_name?.trim() || "";
  const firstName = customer.first_name?.trim() || "";
  const lastName = customer.last_name?.trim() || "";
  const fallbackName = [firstName, lastName].filter(Boolean).join(" ");

  if (customer.customer_type?.trim().toLowerCase() === "commercial" && companyName) {
    return companyName;
  }

  return fallbackName || companyName || fallbackLabel;
}

function mapProjectStatus(statusKey: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    lead: "projects.statusLead",
    estimating: "projects.statusEstimating",
    approved: "projects.statusApproved",
    scheduled: "projects.statusScheduled",
    in_progress: "projects.statusInProgress",
    on_hold: "projects.statusOnHold",
    completed: "projects.statusCompleted",
    cancelled: "projects.statusCancelled",
  };

  return map[statusKey] ? t(map[statusKey]) : normalizeProjectStatus(statusKey).label;
}