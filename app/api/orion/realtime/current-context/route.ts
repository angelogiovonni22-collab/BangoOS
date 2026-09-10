import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { recordBosInternalIntelligenceUsageEvent } from "@/lib/billing/intelligence-usage-events";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

function routeEntityId(pathname: string, entity: string) {
  const match = pathname.match(new RegExp(`^/${entity}/([^/?#]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function safeBosUrl(raw: unknown, requestUrl: string) {
  if (typeof raw !== "string" || !raw.trim()) return new URL(requestUrl);
  try {
    const candidate = new URL(raw, requestUrl);
    const requestOrigin = new URL(requestUrl).origin;
    if (candidate.origin !== requestOrigin) return new URL(requestUrl);
    return candidate;
  } catch {
    return new URL(requestUrl);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ ok: false, error: "Supabase is unavailable." }, { status: 503 });

    const workspace = await resolveWorkspaceContext(supabase);
    if (!workspace.context) {
      return NextResponse.json({
        ok: false,
        error: workspace.errorMessage || "Workspace context is unavailable.",
        statusCategory: workspace.errorCode === "unauthenticated" ? "authentication_required" : "permission_denied",
      }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
    }

    const body = await req.json().catch(() => ({})) as { href?: unknown };
    const url = safeBosUrl(body.href, req.url);
    const pathname = url.pathname || "/dashboard";
    const projectId = url.searchParams.get("projectId") || routeEntityId(pathname, "projects");
    const customerId = url.searchParams.get("customerId") || routeEntityId(pathname, "customers");
    const estimateId = url.searchParams.get("estimateId") || routeEntityId(pathname, "estimates");
    const invoiceId = url.searchParams.get("invoiceId") || routeEntityId(pathname, "invoices");
    const employeeId = url.searchParams.get("employeeId") || routeEntityId(pathname, "employees");
    const crewId = url.searchParams.get("crewId") || routeEntityId(pathname, "crews");

    let project: Record<string, unknown> | null = null;
    if (projectId) {
      const { data, error } = await supabase
        .from("projects")
        .select("id,name,project_number,project_type,status,description,address_line_1,city,state,postal_code,estimated_cost,contract_amount,estimated_start_date,estimated_end_date,actual_end_date")
        .eq("company_id", workspace.context.companyId)
        .eq("id", projectId)
        .maybeSingle();
      if (error) {
        return NextResponse.json({ ok: false, error: "Unable to load current project context.", statusCategory: "context_error" }, { status: 400 });
      }
      project = data;
    }

    await recordBosInternalIntelligenceUsageEvent(supabase, {
      companyId: workspace.context.companyId,
      product: "orion_voice",
      operationKey: `orion-realtime-context-${randomUUID()}`,
      sourceType: projectId ? "project" : "orion_realtime_context",
      sourceId: projectId,
      metadata: {
        executionMode: "orion_realtime_live_context",
        activeProjectContextLoaded: Boolean(project),
        pathname,
        providerCostStatus: "not_applicable",
      },
    });

    const projectName = typeof project?.name === "string" ? project.name : null;
    return NextResponse.json({
      ok: true,
      statusCategory: "context_resolved",
      userMessage: projectName
        ? `Current BOS page context resolved. The active project is ${projectName}. Use the returned project details instead of asking the user which project they mean.`
        : "Current BOS page context resolved.",
      details: {
        pathname,
        projectId,
        customerId,
        estimateId,
        invoiceId,
        employeeId,
        crewId,
        project,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to resolve current BOS context.", statusCategory: "context_error" }, { status: 500 });
  }
}
