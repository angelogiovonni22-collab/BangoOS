import type { SupabaseClient } from "@supabase/supabase-js";

export const BLUEPRINT_MEDIA_BUCKET = "blueprint-media";
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const maxBytes = 20 * 1024 * 1024;

export type BlueprintMediaAttachment = { id: string; x: number; y: number; pageNumber: number; caption: string; fileName: string; signedUrl: string; createdBy: string };
type Identity = { companyId: string; projectId: string; versionId: string };
function table(supabase: SupabaseClient) { return (supabase as unknown as { from: (name: string) => ReturnType<SupabaseClient["from"]> }).from("blueprint_media_attachments"); }

export function validateBlueprintMedia(file: File) {
  if (!allowedTypes.has(file.type)) return "Use a JPEG, PNG, WebP, HEIC, or HEIF image.";
  if (file.size < 1 || file.size > maxBytes) return "Media attachments must be 20 MB or smaller.";
  return null;
}

export async function loadBlueprintMedia(supabase: SupabaseClient, identity: Identity) {
  const response = await table(supabase).select("id, page_number, x, y, caption, storage_path, original_filename, created_by")
    .eq("company_id", identity.companyId).eq("project_id", identity.projectId).eq("blueprint_version_id", identity.versionId).order("created_at");
  if (response.error) throw response.error;
  const rows = (response.data ?? []) as Array<Record<string, unknown>>;
  const paths = rows.map((row) => String(row.storage_path));
  const signed = paths.length ? await supabase.storage.from(BLUEPRINT_MEDIA_BUCKET).createSignedUrls(paths, 60 * 30) : { data: [], error: null };
  if (signed.error) throw signed.error;
  return rows.map((row, index) => ({ id: String(row.id), x: Number(row.x), y: Number(row.y), pageNumber: Number(row.page_number), caption: typeof row.caption === "string" ? row.caption : "", fileName: String(row.original_filename), signedUrl: signed.data?.[index]?.signedUrl ?? "", createdBy: String(row.created_by) } satisfies BlueprintMediaAttachment));
}

export async function uploadBlueprintMedia(supabase: SupabaseClient, input: Identity & { userId: string; pageNumber: number; x: number; y: number; caption: string; file: File }) {
  const error = validateBlueprintMedia(input.file); if (error) throw new Error(error);
  const safeName = input.file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-") || "field-photo";
  const storagePath = `${input.companyId}/${input.projectId}/${input.versionId}/${crypto.randomUUID()}-${safeName}`;
  const upload = await supabase.storage.from(BLUEPRINT_MEDIA_BUCKET).upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
  if (upload.error) throw upload.error;
  const insert = await table(supabase).insert({ company_id: input.companyId, project_id: input.projectId, blueprint_version_id: input.versionId, page_number: input.pageNumber, x: input.x, y: input.y, caption: input.caption.trim() || null, storage_path: storagePath, original_filename: input.file.name, mime_type: input.file.type, file_size_bytes: input.file.size, created_by: input.userId });
  if (insert.error) { await supabase.storage.from(BLUEPRINT_MEDIA_BUCKET).remove([storagePath]); throw insert.error; }
}
