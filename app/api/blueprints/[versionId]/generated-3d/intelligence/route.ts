import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { BosBuildingGraph } from "@/lib/blueprints/engine/building-graph";
import {
  buildBlueprintCostingIntegration,
  buildRealityEngineAlignmentContract,
  deriveValidatedBlueprintQuantities,
  queryBuildingGraph,
  summarizeBuildingGraphForOrion,
  type BosGraphQuery,
} from "@/lib/blueprints/engine/downstream-intelligence";
import type { Database } from "@/types/database.types";

function dbClient(supabase: SupabaseClient<Database>) {
  // Blueprint Engine migration-backed fields intentionally remain usable before generated types refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

const OBJECT_TYPES = new Set<BosGraphQuery["objectType"]>(["wall", "opening", "room", "stair", "deck_porch"]);

export async function GET(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    const supabase = await createClient();
    if (!supabase) throw new Error("B.O.S. database is unavailable.");
    const typed = supabase as SupabaseClient<Database>;
    const workspace = await resolveWorkspaceContext(typed);
    if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
    const db = dbClient(typed);

    const response = await db.from("blueprint_generated_models")
      .select("building_graph,engine_status,status")
      .eq("company_id", workspace.context.companyId)
      .eq("source_version_id", versionId)
      .maybeSingle();
    if (response.error) throw new Error(response.error.message);
    if (!response.data?.building_graph) return NextResponse.json({ error: "A native B.O.S. Building Graph is required before downstream Blueprint intelligence is available." }, { status: 409 });
    if (response.data.engine_status !== "reconstructed" || response.data.status !== "ready") {
      return NextResponse.json({ error: "B.O.S. downstream intelligence is withheld until this Building Graph passes native reconstruction validation." }, { status: 409 });
    }

    const graph = response.data.building_graph as BosBuildingGraph;
    const url = new URL(request.url);
    const requestedType = url.searchParams.get("objectType") as BosGraphQuery["objectType"] | null;
    if (requestedType && !OBJECT_TYPES.has(requestedType)) return NextResponse.json({ error: "Unsupported Building Graph object type." }, { status: 400 });
    const query: BosGraphQuery = {
      levelId: url.searchParams.get("levelId") || undefined,
      objectId: url.searchParams.get("objectId") || undefined,
      roomName: url.searchParams.get("roomName") || undefined,
      objectType: requestedType || undefined,
    };
    const queryRequested = Boolean(query.levelId || query.objectId || query.roomName || query.objectType);

    return NextResponse.json({
      summary: summarizeBuildingGraphForOrion(graph),
      quantities: deriveValidatedBlueprintQuantities(graph),
      costing: buildBlueprintCostingIntegration(graph),
      realityAlignment: buildRealityEngineAlignmentContract(graph),
      objects: queryRequested ? queryBuildingGraph(graph, query) : [],
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Blueprint Building Graph intelligence." }, { status: 400 });
  }
}
