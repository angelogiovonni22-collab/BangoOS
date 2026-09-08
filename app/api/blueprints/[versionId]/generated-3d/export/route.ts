import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { buildBosBuildingGraphIfc } from "@/lib/blueprints/engine/graph-to-ifc";
import type { BosBuildingGraph } from "@/lib/blueprints/engine/building-graph";
import type { Database } from "@/types/database.types";

function dbClient(supabase: SupabaseClient<Database>) {
  // Migration-backed columns intentionally remain usable before generated Supabase types refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    const format = new URL(request.url).searchParams.get("format") || "ifc";
    if (format !== "ifc") return NextResponse.json({ error: "Only IFC export is available from this endpoint." }, { status: 400 });
    const supabase = await createClient();
    if (!supabase) throw new Error("B.O.S. database is unavailable.");
    const typed = supabase as SupabaseClient<Database>;
    const workspace = await resolveWorkspaceContext(typed);
    if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
    const db = dbClient(typed);
    const response = await db.from("blueprint_generated_models")
      .select("building_graph,engine_status")
      .eq("company_id", workspace.context.companyId)
      .eq("source_version_id", versionId)
      .maybeSingle();
    if (response.error) throw new Error(response.error.message);
    if (!response.data?.building_graph) return NextResponse.json({ error: "A native B.O.S. Building Graph is required before IFC export." }, { status: 409 });
    if (response.data.engine_status !== "reconstructed" && response.data.engine_status !== "needs_review") {
      return NextResponse.json({ error: "This reconstruction must be reviewed or completed before IFC export." }, { status: 409 });
    }
    const graph = response.data.building_graph as BosBuildingGraph;
    const ifc = buildBosBuildingGraphIfc(graph);
    return new Response(ifc, {
      status: 200,
      headers: {
        "Content-Type": "application/x-step; charset=utf-8",
        "Content-Disposition": `attachment; filename="bos-blueprint-${versionId}.ifc"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to export Blueprint IFC." }, { status: 400 });
  }
}
