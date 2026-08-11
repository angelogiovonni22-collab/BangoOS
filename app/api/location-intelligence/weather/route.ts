import { NextRequest, NextResponse } from "next/server";
import { getLocationForecast } from "@/lib/location-intelligence";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const ACTIVE_STATUSES = ["approved", "scheduled", "in_progress"];

export async function GET(request: NextRequest) {
  return handleWeatherRequest(request, null);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { projectId?: string; postalCode?: string };
  const projectId = body.projectId?.trim() || null;
  const postalCode = body.postalCode?.trim() || null;
  if (!projectId || !postalCode) {
    return NextResponse.json({ ok: false, error: "A project and valid ZIP code are required." }, { status: 400 });
  }
  return handleWeatherRequest(request, { projectId, postalCode });
}

async function handleWeatherRequest(request: NextRequest, override: { projectId: string; postalCode: string } | null) {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ ok: false, error: "BOS workspace is unavailable." }, { status: 503 });
    const workspace = await resolveWorkspaceContext(supabase);
    if (!workspace.context) {
      return NextResponse.json({ ok: false, error: workspace.errorMessage || "BOS workspace is unavailable." }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
    }

    const projectId = override?.projectId || request.nextUrl.searchParams.get("projectId")?.trim() || null;
    let query = supabase
      .from("projects")
      .select("id, name, address_line_1, city, state, postal_code, status, weather_postal_code_override, job_site_latitude, job_site_longitude, job_site_geocoded_at")
      .eq("company_id", workspace.context.companyId);

    query = projectId
      ? query.eq("id", projectId)
      : query.in("status", ACTIVE_STATUSES).order("updated_at", { ascending: false }).limit(1);

    const projectResponse = await query.maybeSingle();
    if (projectResponse.error) throw projectResponse.error;
    const project = projectResponse.data;
    if (!project) {
      return NextResponse.json({ ok: false, error: "Add a jobsite address or ZIP code to an active project to see live weather." }, { status: 404 });
    }

    const postalOverride = override?.postalCode || project.weather_postal_code_override;
    const search = postalOverride || [project.postal_code, project.city, project.state].filter(Boolean).join(", ")
      || [project?.address_line_1, project?.city, project?.state].filter(Boolean).join(", ");
    if (!search) {
      return NextResponse.json({ ok: false, error: "This project needs a valid jobsite address or ZIP code." }, { status: 422 });
    }

    const forecast = await getLocationForecast(search);
    const geocodedAt = project.job_site_geocoded_at ? new Date(project.job_site_geocoded_at).getTime() : 0;
    const coordinatesAreStale = !geocodedAt || Date.now() - geocodedAt > 24 * 60 * 60 * 1000;
    if (override || project.job_site_latitude === null || project.job_site_longitude === null || coordinatesAreStale) {
      const locationUpdate = await supabase
        .from("projects")
        .update({
          job_site_latitude: forecast.latitude,
          job_site_longitude: forecast.longitude,
          job_site_geocoded_at: new Date().toISOString(),
          ...(override ? { weather_postal_code_override: override.postalCode } : {}),
        })
        .eq("company_id", workspace.context.companyId)
        .eq("id", project.id);
      if (locationUpdate.error) throw locationUpdate.error;
    }
    const directionsAddress = [project?.address_line_1, project?.city, project?.state, project?.postal_code].filter(Boolean).join(", ");
    return NextResponse.json({
      ok: true,
      projectId: project?.id ?? null,
      projectName: project?.name ?? null,
      directionsAddress: directionsAddress || forecast.resolvedAddress,
      forecast,
    }, { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Location intelligence is unavailable." }, { status: 500 });
  }
}
