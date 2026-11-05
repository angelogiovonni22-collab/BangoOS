import type { AttachmentItem } from "./types";

type PhotoRow = { id: string; company_id: string; project_id: string; storage_path: string; original_filename: string; mime_type: string | null };
type Result = { data: unknown; error: { message?: string } | null };
type Query = PromiseLike<Result> & { select(columns: string): Query; eq(column: string, value: string): Query; in(column: string, values: string[]): Query };
export type ReportPhotoClient = {
  from(table: string): Query;
  storage: { from(bucket: string): { createSignedUrl(path: string, seconds: number): Promise<{ data: { signedUrl?: string } | null; error: { message?: string } | null }> } };
};
export type ReportPhotoEvidence = { attachment: AttachmentItem; url: string | null; isImage: boolean; message: string | null };

export async function loadReportPhotoEvidence(client: ReportPhotoClient, companyId: string, projectId: string, attachments: AttachmentItem[]): Promise<ReportPhotoEvidence[]> {
  if (!companyId || !projectId) throw new Error("A verified workspace and project are required.");
  const ids = [...new Set(attachments.flatMap(item => item.projectPhotoId ? [item.projectPhotoId] : []))];
  const names = [...new Set(attachments.filter(item => !item.projectPhotoId).map(item => item.fileName).filter(Boolean))];
  const read = async (column: string, values: string[]) => {
    if (!values.length) return [];
    const result = await client.from("project_photos")
      .select("id,company_id,project_id,storage_path,original_filename,mime_type")
      .eq("company_id", companyId).eq("project_id", projectId).in(column, values);
    if (result.error) throw new Error("Unable to load report photos. Try again.");
    if (!Array.isArray(result.data)) throw new Error("Report photo data is unavailable.");
    return result.data.filter((value): value is PhotoRow => {
      if (!value || typeof value !== "object") return false;
      const row = value as Partial<PhotoRow>;
      return typeof row.id === "string" && row.company_id === companyId && row.project_id === projectId
        && typeof row.original_filename === "string" && typeof row.storage_path === "string"
        && row.storage_path.startsWith(`${companyId}/${projectId}/`)
        && !row.storage_path.split("/").some(part => {
          try { const decoded = decodeURIComponent(part); return decoded === "." || decoded === ".." || /[\\\\/]/.test(decoded); }
          catch { return true; }
        });
    });
  };
  const [byId, byName] = await Promise.all([read("id", ids), read("original_filename", names)]);
  return Promise.all(attachments.map(async attachment => {
    const matches = attachment.projectPhotoId
      ? byId.filter(row => row.id === attachment.projectPhotoId)
      : byName.filter(row => row.original_filename === attachment.fileName);
    const unique = [...new Map(matches.map(row => [row.id, row])).values()];
    if (unique.length !== 1) return { attachment, url: null, isImage: false, message: unique.length > 1 ? "More than one project photo has this filename. Open project photos to identify it." : "Linked photo is unavailable or access is restricted." };
    const photo = unique[0];
    const signed = await client.storage.from("project-photos").createSignedUrl(photo.storage_path, 300);
    return { attachment, url: signed.error ? null : signed.data?.signedUrl || null, isImage: Boolean(photo.mime_type?.startsWith("image/")), message: signed.error || !signed.data?.signedUrl ? "Unable to open this photo. Refresh photos to try again." : null };
  }));
}
