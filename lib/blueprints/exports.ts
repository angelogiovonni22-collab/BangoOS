import type { SupabaseClient } from "@supabase/supabase-js";
import { loadBlueprintMarkups } from "./markups";
import { loadBlueprintMedia } from "./media-attachments";

type PackageIdentity = { companyId: string; projectId: string; versionId: string; userId: string };
export type BlueprintPackageDocument = { fileName: string; revision: string; discipline: string; originalFileName: string; revisionHistory: unknown[] };

export async function buildBlueprintPackage(supabase: SupabaseClient, identity: PackageIdentity, document: BlueprintPackageDocument, projectName: string) {
  const [annotations, media] = await Promise.all([loadBlueprintMarkups(supabase, identity), loadBlueprintMedia(supabase, identity)]);
  return {
    schema: "bango.blueprint-package.v1",
    generatedAt: new Date().toISOString(),
    project: { id: identity.projectId, name: projectName },
    blueprint: { versionId: identity.versionId, ...document },
    annotations,
    media: media.map(({ signedUrl: _signedUrl, ...item }) => item),
    summary: { annotations: annotations.length, openIssues: annotations.filter((item) => item.type === "pin" && item.status === "open").length, measurements: annotations.filter((item) => ["calibration", "distance", "area"].includes(item.type)).length, media: media.length },
  };
}

export function downloadBlueprintJson(snapshot: object, fileName: string) { downloadBlob(JSON.stringify(snapshot, null, 2), `${safeName(fileName)}-package.json`, "application/json"); }
export function downloadBlueprintCsv(snapshot: Awaited<ReturnType<typeof buildBlueprintPackage>>, fileName: string) {
  const header = ["id","type","status","page","content","color","created_by","created_at"];
  const rows = snapshot.annotations.map((item) => [item.id,item.type,item.status,String(item.geometry.page ?? 1),item.content,item.color,item.createdBy,item.createdAt]);
  downloadBlob([header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"), `${safeName(fileName)}-annotations.csv`, "text/csv");
}
export async function createShareableBlueprintPackage(supabase: SupabaseClient, identity: PackageIdentity, snapshot: object, packageName: string, ttlDays = 14) {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(tokenBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const db = supabase as unknown as { from: (name: string) => ReturnType<SupabaseClient["from"]> };
  const response = await db.from("blueprint_plan_packages").insert({ company_id: identity.companyId, project_id: identity.projectId, blueprint_version_id: identity.versionId, package_name: packageName, token_hash: tokenHash, snapshot, expires_at: new Date(Date.now() + ttlDays * 86400000).toISOString(), created_by: identity.userId });
  if (response.error) throw response.error;
  return token;
}
function safeName(value: string) { return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "blueprint"; }
function csvCell(value: string) { return `"${value.replaceAll('"', '""')}"`; }
function downloadBlob(content: string, name: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const link = window.document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }
