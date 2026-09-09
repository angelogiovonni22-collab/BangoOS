import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

function dbClient(supabase: SupabaseClient<Database>) {
  // Native Blueprint Engine fields are migration-backed while generated database types catch up.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

type ModelRow = {
  engine_status: string | null;
  confidence: number | string | null;
  validation_report: { score?: number; status?: string; issues?: Array<{ code?: string; severity?: string }> } | null;
  reconstruction_version: string | null;
  error_message: string | null;
  updated_at: string | null;
};

function numeric(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    if (!supabase) throw new Error("B.O.S. database is unavailable.");
    const typed = supabase as SupabaseClient<Database>;
    const workspace = await resolveWorkspaceContext(typed);
    if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
    const db = dbClient(typed);
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");

    let query = db.from("blueprint_generated_models")
      .select("engine_status,confidence,validation_report,reconstruction_version,error_message,updated_at")
      .eq("company_id", workspace.context.companyId)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (projectId) query = query.eq("project_id", projectId);
    const response = await query;
    if (response.error) throw new Error(response.error.message);
    const rows = (response.data || []) as ModelRow[];

    const statusCounts: Record<string, number> = {};
    const failureCodes: Record<string, number> = {};
    let confidenceTotal = 0;
    let validationTotal = 0;
    let validationCount = 0;
    for (const row of rows) {
      const status = row.engine_status || "unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      confidenceTotal += numeric(row.confidence);
      const validationScore = row.validation_report?.score;
      if (typeof validationScore === "number" && Number.isFinite(validationScore)) {
        validationTotal += validationScore;
        validationCount += 1;
      }
      for (const issue of row.validation_report?.issues || []) {
        if (!issue.code) continue;
        failureCodes[issue.code] = (failureCodes[issue.code] || 0) + 1;
      }
      if (row.error_message && !(row.validation_report?.issues || []).length) failureCodes.RUNTIME_ERROR = (failureCodes.RUNTIME_ERROR || 0) + 1;
    }

    return NextResponse.json({
      scope: { companyId: workspace.context.companyId, projectId: projectId || null },
      sampleSize: rows.length,
      statusCounts,
      averageConfidence: rows.length ? confidenceTotal / rows.length : 0,
      averageValidationScore: validationCount ? validationTotal / validationCount : 0,
      failureCodes,
      reconstructionVersions: [...new Set(rows.map((row) => row.reconstruction_version).filter(Boolean))],
      latestUpdatedAt: rows[0]?.updated_at || null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Blueprint Engine telemetry." }, { status: 400 });
  }
}
