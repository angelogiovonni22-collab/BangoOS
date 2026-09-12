import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BLUEPRINTS_BUCKET } from "@/lib/blueprints/plan-room";
import { DEFAULT_RASTER_LINE_OPTIONS, renderBlueprintPdfPage } from "@/lib/blueprints/engine/raster";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

export const maxDuration = 30;

function dbClient(supabase: SupabaseClient<Database>) {
  // Migration-backed Blueprint tables intentionally remain usable before generated types refresh.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase as any;
}

async function pdfPageSize(buffer: Buffer, pageNumber: number) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const document = await loadingTask.promise;
  try {
    if (pageNumber < 1 || pageNumber > document.numPages) throw new Error("Selected Blueprint source page is out of range.");
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    page.cleanup();
    return { width: viewport.width, height: viewport.height };
  } finally {
    await document.destroy();
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    const { versionId } = await params;
    const supabase = await createClient();
    if (!supabase) throw new Error("B.O.S. database is unavailable.");
    const typed = supabase as SupabaseClient<Database>;
    const workspace = await resolveWorkspaceContext(typed);
    if (!workspace.context) return NextResponse.json({ error: workspace.errorMessage || "Unauthorized." }, { status: 401 });
    const db = dbClient(typed);

    const sourceResponse = await db.from("blueprint_versions")
      .select("id,company_id,storage_path,mime_type")
      .eq("id", versionId)
      .eq("company_id", workspace.context.companyId)
      .maybeSingle();
    if (sourceResponse.error) throw new Error(sourceResponse.error.message);
    if (!sourceResponse.data) return NextResponse.json({ error: "Blueprint revision not found." }, { status: 404 });
    if (sourceResponse.data.mime_type !== "application/pdf") {
      return NextResponse.json({ error: "Source overlay preview currently requires a PDF Blueprint." }, { status: 415 });
    }

    const modelResponse = await db.from("blueprint_generated_models")
      .select("source_page")
      .eq("company_id", workspace.context.companyId)
      .eq("source_version_id", versionId)
      .maybeSingle();
    if (modelResponse.error) throw new Error(modelResponse.error.message);
    const sourcePage = Math.max(1, Number(modelResponse.data?.source_page || 1));

    const downloaded = await typed.storage.from(BLUEPRINTS_BUCKET).download(String(sourceResponse.data.storage_path));
    if (downloaded.error || !downloaded.data) throw new Error(downloaded.error?.message || "Unable to read the source Blueprint.");
    const buffer = Buffer.from(await downloaded.data.arrayBuffer());
    const [size, image] = await Promise.all([
      pdfPageSize(buffer, sourcePage),
      renderBlueprintPdfPage(buffer, { ...DEFAULT_RASTER_LINE_OPTIONS, maxDimension: 1800 }, sourcePage),
    ]);

    return new Response(new Uint8Array(image), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
        "X-BOS-Source-Page": String(sourcePage),
        "X-BOS-Source-Width": String(size.width),
        "X-BOS-Source-Height": String(size.height),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to render Blueprint source overlay." }, { status: 400 });
  }
}
