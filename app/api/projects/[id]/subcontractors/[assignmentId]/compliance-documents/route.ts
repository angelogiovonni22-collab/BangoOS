import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

const BUCKET = "subcontractor-compliance";
const MAX_BYTES = 20 * 1024 * 1024;
const INTERNAL_ROLES = new Set(["owner", "administrator", "office_manager", "project_manager"]);
const ALLOWED_REQUIREMENTS = new Set(["w9", "coi", "workers_comp", "licenses", "safety_acknowledgement"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
}

async function context(projectId: string, assignmentId: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. database is unavailable.");
  const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
  if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
  if (!INTERNAL_ROLES.has((workspace.context.role || "").toLowerCase())) {
    throw new Error("You are not authorized to manage subcontractor compliance documents.");
  }
  const admin = createAdminClient();
  const { data: assignment } = await admin
    .from("trade_partner_assignments")
    .select("id,company_id,project_id,vendor_id")
    .eq("company_id", workspace.context.companyId)
    .eq("project_id", projectId)
    .eq("id", assignmentId)
    .single();
  if (!assignment) throw new Error("Subcontractor assignment not found.");
  return { admin, workspace: workspace.context, assignment };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const { id: projectId, assignmentId } = await params;
    const { admin, workspace } = await context(projectId, assignmentId);
    const { data: rows, error } = await admin
      .from("subcontractor_compliance_documents" as never)
      .select("id,requirement_type,original_filename,mime_type,file_size_bytes,expires_at,status,storage_path,created_at")
      .eq("company_id", workspace.companyId)
      .eq("assignment_id", assignmentId)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const documents = await Promise.all(((rows || []) as Array<Record<string, unknown>>).map(async (row) => {
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(String(row.storage_path), 60 * 10);
      return {
        id: row.id,
        requirementType: row.requirement_type,
        originalFilename: row.original_filename,
        mimeType: row.mime_type,
        fileSizeBytes: row.file_size_bytes,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        viewUrl: signed?.signedUrl || null,
      };
    }));
    return NextResponse.json({ documents });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load compliance documents." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  let uploadedPath: string | null = null;
  try {
    const { id: projectId, assignmentId } = await params;
    const { admin, workspace, assignment } = await context(projectId, assignmentId);
    const form = await request.formData();
    const file = form.get("file");
    const requirementType = String(form.get("requirementType") || "");
    const expiresAtRaw = String(form.get("expiresAt") || "").trim();

    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a compliance document to upload." }, { status: 400 });
    if (!ALLOWED_REQUIREMENTS.has(requirementType)) return NextResponse.json({ error: "Invalid compliance requirement." }, { status: 400 });
    if (!ALLOWED_MIME_TYPES.has(file.type)) return NextResponse.json({ error: "Upload a PDF, image, DOC, or DOCX file." }, { status: 400 });
    if (file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ error: "Compliance documents must be 20 MB or smaller." }, { status: 400 });
    if (expiresAtRaw && Number.isNaN(Date.parse(expiresAtRaw))) return NextResponse.json({ error: "Expiration date is invalid." }, { status: 400 });

    const storagePath = `${workspace.companyId}/${assignment.vendor_id}/${assignmentId}/${requirementType}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
    uploadedPath = storagePath;
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage.from(BUCKET).upload(storagePath, bytes, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message || "Unable to upload compliance document.");

    await admin
      .from("subcontractor_compliance_documents" as never)
      .update({ status: "superseded", updated_at: new Date().toISOString() } as never)
      .eq("company_id", workspace.companyId)
      .eq("assignment_id", assignmentId)
      .eq("requirement_type", requirementType)
      .eq("status", "active");

    const { data: document, error: metadataError } = await admin
      .from("subcontractor_compliance_documents" as never)
      .insert({
        company_id: workspace.companyId,
        project_id: projectId,
        assignment_id: assignmentId,
        vendor_id: assignment.vendor_id,
        requirement_type: requirementType,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        file_size_bytes: file.size,
        expires_at: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null,
        status: "active",
        uploaded_by: workspace.userId,
      } as never)
      .select("id,original_filename")
      .single();
    if (metadataError || !document) throw new Error(metadataError?.message || "Unable to record compliance document.");

    await admin
      .from("subcontractor_mobilization_requirements" as never)
      .update({
        status: "pending",
        verified_at: null,
        verified_by: null,
        expires_at: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null,
        evidence: { compliance_document_id: (document as Record<string, unknown>).id, original_filename: file.name },
        updated_at: new Date().toISOString(),
      } as never)
      .eq("company_id", workspace.companyId)
      .eq("assignment_id", assignmentId)
      .eq("requirement_type", requirementType);

    const { data: refreshed } = await admin.rpc("refresh_subcontractor_mobilization_status" as never, {
      p_company_id: workspace.companyId,
      p_assignment_id: assignmentId,
    } as never) as { data: Array<{ mobilization_status: string; blockers: unknown }> | null };

    return NextResponse.json({
      uploaded: true,
      document,
      mobilizationStatus: refreshed?.[0]?.mobilization_status || "not_cleared",
      blockers: refreshed?.[0]?.blockers || [],
    });
  } catch (error) {
    if (uploadedPath) {
      try { await createAdminClient().storage.from(BUCKET).remove([uploadedPath]); } catch { /* best effort cleanup */ }
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to upload compliance document." }, { status: 400 });
  }
}
