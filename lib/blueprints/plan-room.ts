import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentDiscipline, DocumentStatus, PlanDocument, RevisionItem } from "@/components/plans/types";

export const BLUEPRINTS_BUCKET = "blueprints";
export const MAX_BLUEPRINT_BYTES = 100 * 1024 * 1024;
export const BLUEPRINT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export type BlueprintDiscipline = Exclude<DocumentDiscipline, "Photos" | "Archived"> | "Other";

export type BlueprintUploadInput = {
  companyId: string;
  projectId: string;
  userId: string;
  file: File;
  discipline: BlueprintDiscipline;
  sheetNumber: string;
  title: string;
  revisionLabel: string;
};

function safeFilename(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "blueprint";
}

export function validateBlueprintFile(file: File): string | null {
  if (!BLUEPRINT_MIME_TYPES.includes(file.type as (typeof BLUEPRINT_MIME_TYPES)[number])) {
    return "Use a PDF, JPEG, PNG, or WebP blueprint file.";
  }
  if (file.size < 1 || file.size > MAX_BLUEPRINT_BYTES) {
    return "Blueprint files must be 100 MB or smaller.";
  }
  return null;
}

export async function uploadBlueprint(params: { supabase: SupabaseClient; input: BlueprintUploadInput }) {
  const { supabase, input } = params;
  const validationError = validateBlueprintFile(input.file);
  if (validationError) throw new Error(validationError);

  const sheetNumber = input.sheetNumber.trim();
  const title = input.title.trim();
  const revisionLabel = input.revisionLabel.trim() || "Initial";
  if (!sheetNumber || !title) throw new Error("Sheet number and title are required.");

  const db = supabase as unknown as { from: (table: string) => ReturnType<SupabaseClient["from"]> };
  const client = supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  let setId: string | null = null;
  let sheetId: string | null = null;
  let storagePath: string | null = null;

  try {
    const sheetResponse = await client.rpc("create_blueprint_sheet_upload", {
      project_record_id: input.projectId,
      plan_discipline: input.discipline,
      plan_sheet_number: sheetNumber,
      plan_title: title,
    });
    if (sheetResponse.error) throw new Error(`Could not create Blueprint metadata: ${sheetResponse.error.message}`);
    const created = Array.isArray(sheetResponse.data) ? sheetResponse.data[0] as Record<string, unknown> | undefined : sheetResponse.data as Record<string, unknown> | null;
    if (!created?.blueprint_set_id || !created.blueprint_sheet_id || created.company_id !== input.companyId) throw new Error("BOS could not verify the Blueprint workspace identity.");
    setId = String(created.blueprint_set_id);
    sheetId = String(created.blueprint_sheet_id);

    storagePath = `${input.companyId}/${input.projectId}/${sheetId}/${crypto.randomUUID()}-${safeFilename(input.file.name)}`;
    const uploadResponse = await supabase.storage.from(BLUEPRINTS_BUCKET).upload(storagePath, input.file, {
      contentType: input.file.type,
      upsert: false,
    });
    if (uploadResponse.error) throw new Error(`Could not store the Blueprint file: ${uploadResponse.error.message}`);

    const versionResponse = await client.rpc("register_initial_blueprint_version", {
      sheet_record_id: sheetId,
      revision_name: revisionLabel,
      object_path: storagePath,
      source_filename: input.file.name,
      source_mime_type: input.file.type,
      source_file_size: input.file.size,
    });
    if (versionResponse.error) throw new Error(`Could not register the Blueprint revision: ${versionResponse.error.message}`);
  } catch (error) {
    if (storagePath) await supabase.storage.from(BLUEPRINTS_BUCKET).remove([storagePath]);
    if (sheetId) await db.from("blueprint_sheets").delete().eq("id", sheetId).eq("company_id", input.companyId);
    if (setId) await db.from("blueprint_sets").delete().eq("id", setId).eq("company_id", input.companyId);
    throw error;
  }
}

export async function uploadBlueprintRevision(params: {
  supabase: SupabaseClient;
  companyId: string;
  projectId: string;
  sheetId: string;
  revisionLabel: string;
  notes?: string;
  file: File;
}) {
  const validationError = validateBlueprintFile(params.file);
  if (validationError) throw new Error(validationError);
  if (!params.revisionLabel.trim()) throw new Error("Revision label is required.");

  const storagePath = `${params.companyId}/${params.projectId}/${params.sheetId}/${crypto.randomUUID()}-${safeFilename(params.file.name)}`;
  const uploadResponse = await params.supabase.storage.from(BLUEPRINTS_BUCKET).upload(storagePath, params.file, {
    contentType: params.file.type,
    upsert: false,
  });
  if (uploadResponse.error) throw uploadResponse.error;

  const client = params.supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const revisionResponse = await client.rpc("register_blueprint_revision", {
    sheet_record_id: params.sheetId,
    revision_name: params.revisionLabel.trim(),
    object_path: storagePath,
    source_filename: params.file.name,
    source_mime_type: params.file.type,
    source_file_size: params.file.size,
    revision_notes: params.notes?.trim() || null,
  });
  if (revisionResponse.error) {
    await params.supabase.storage.from(BLUEPRINTS_BUCKET).remove([storagePath]);
    throw new Error(revisionResponse.error.message);
  }
}

export async function loadProjectBlueprints(params: {
  supabase: SupabaseClient;
  companyId: string;
  projectId: string;
}): Promise<PlanDocument[]> {
  const db = params.supabase as unknown as { from: (table: string) => ReturnType<SupabaseClient["from"]> };
  const sheetsResponse = await db.from("blueprint_sheets")
    .select("id, sheet_number, title, discipline, created_at")
    .eq("company_id", params.companyId)
    .eq("project_id", params.projectId)
    .order("sort_order", { ascending: true });
  if (sheetsResponse.error) throw sheetsResponse.error;

  const sheetRows = (sheetsResponse.data ?? []) as Array<Record<string, unknown>>;
  if (!sheetRows.length) return [];
  const sheetIds = sheetRows.map((row) => String(row.id));
  const versionsResponse = await db.from("blueprint_versions")
    .select("id, blueprint_sheet_id, version_number, revision_label, status, storage_path, original_filename, mime_type, file_size_bytes, uploaded_by, created_at, issued_at, notes")
    .eq("company_id", params.companyId)
    .eq("project_id", params.projectId)
    .in("blueprint_sheet_id", sheetIds)
    .order("version_number", { ascending: false });
  if (versionsResponse.error) throw versionsResponse.error;

  const versionRows = (versionsResponse.data ?? []) as Array<Record<string, unknown>>;
  const signedPaths = versionRows.map((row) => String(row.storage_path));
  const signedResponse = signedPaths.length
    ? await params.supabase.storage.from(BLUEPRINTS_BUCKET).createSignedUrls(signedPaths, 60 * 60)
    : { data: [], error: null };
  const signedUrlByPath = new Map((signedResponse.data ?? []).map((item) => [item.path, item.signedUrl]));

  return sheetRows.flatMap((sheet) => {
    const versions = versionRows.filter((version) => String(version.blueprint_sheet_id) === String(sheet.id));
    const current = versions[0];
    if (!current) return [];
    const revisionHistory: RevisionItem[] = versions.map((version) => ({
      id: String(version.id),
      revision: String(version.revision_label),
      issuedAt: String(version.issued_at || version.created_at),
      approvedBy: "BOS workspace",
      approvalStatus: mapRevisionStatus(String(version.status)),
      notes: typeof version.notes === "string" ? version.notes : "",
    }));

    return [{
      id: String(sheet.id),
      versionId: String(current.id),
      fileName: `${String(sheet.sheet_number)} · ${String(sheet.title)}`,
      originalFileName: String(current.original_filename),
      discipline: mapDiscipline(String(sheet.discipline)),
      revision: String(current.revision_label),
      status: mapDocumentStatus(String(current.status)),
      uploadedBy: "BOS workspace",
      uploadedAt: String(current.created_at),
      sizeInBytes: Number(current.file_size_bytes),
      linkedRfis: 0,
      linkedSubmittals: 0,
      fileUrl: signedUrlByPath.get(String(current.storage_path)) || null,
      mimeType: String(current.mime_type),
      revisionHistory,
    } satisfies PlanDocument];
  });
}

function mapDiscipline(value: string): DocumentDiscipline {
  const supported: DocumentDiscipline[] = ["Architectural", "Structural", "Civil", "Mechanical", "Electrical", "Plumbing", "Fire Protection", "Specifications", "Permits"];
  return supported.includes(value as DocumentDiscipline) ? value as DocumentDiscipline : "Specifications";
}

function mapDocumentStatus(value: string): DocumentStatus {
  const map: Record<string, DocumentStatus> = { draft: "Draft", in_review: "In Review", approved: "Approved", superseded: "Superseded", archived: "Archived" };
  return map[value] || "Draft";
}

function mapRevisionStatus(value: string): RevisionItem["approvalStatus"] {
  const map: Record<string, RevisionItem["approvalStatus"]> = { draft: "Pending", in_review: "Pending", approved: "Approved", superseded: "Superseded", archived: "Superseded" };
  return map[value] || "Pending";
}
