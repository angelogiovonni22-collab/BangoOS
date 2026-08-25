"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FileCheck2, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Badge, Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { ProjectLinkedModuleWorkspace } from "./project-linked-module-workspace";
import { ProjectReceiptsWorkspace } from "./project-receipts-workspace";

type ProjectDocumentsWorkspaceProps = {
  projectId: string;
  localeTag: string;
};

type SignedContractRecord = {
  signatureId: string;
  estimateId: string;
  estimateNumber: string;
  title: string;
  signerName: string;
  signedAt: string;
  verificationResult: string;
  versionNumber: number;
  agreementHash: string | null;
};

export function ProjectDocumentsWorkspace({ projectId, localeTag }: ProjectDocumentsWorkspaceProps) {
  const searchParams = useSearchParams();
  const showReceipts = searchParams.get("section") === "receipts";

  if (showReceipts) return <ProjectReceiptsWorkspace projectId={projectId} />;

  return (
    <div className="space-y-4">
      <ProjectSignedContractsPanel projectId={projectId} localeTag={localeTag} />
      <ProjectLinkedModuleWorkspace projectId={projectId} tab="documents" localeTag={localeTag} />
    </div>
  );
}

function ProjectSignedContractsPanel({ projectId, localeTag }: ProjectDocumentsWorkspaceProps) {
  const supabase = useMemo(() => createClient(), []);
  const [records, setRecords] = useState<SignedContractRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let subscribed = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      const workspace = await resolveWorkspaceContext(supabase);
      if (!supabase || !workspace.context) {
        if (subscribed) {
          setError(workspace.errorMessage || "Unable to load signed contracts.");
          setLoading(false);
        }
        return;
      }

      const db = supabase as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        from: (table: string) => any;
      };
      const companyId = workspace.context.companyId;

      try {
        const estimateResponse = await db
          .from("estimates")
          .select("id, estimate_number, title, agreement_hash, project_id, converted_project_id")
          .eq("company_id", companyId)
          .or(`project_id.eq.${projectId},converted_project_id.eq.${projectId}`);
        if (estimateResponse.error) throw estimateResponse.error;

        const estimates = (estimateResponse.data ?? []) as Array<Record<string, unknown>>;
        const estimateIds = estimates.map((row) => String(row.id || "")).filter(Boolean);
        if (!estimateIds.length) {
          if (subscribed) {
            setRecords([]);
            setLoading(false);
          }
          return;
        }

        const signatureResponse = await db
          .from("estimate_signatures")
          .select("id, estimate_id, typed_name, signed_at, verification_result, estimate_version_number")
          .eq("company_id", companyId)
          .in("estimate_id", estimateIds)
          .eq("verification_result", "verified")
          .order("signed_at", { ascending: false });
        if (signatureResponse.error) throw signatureResponse.error;

        const estimateById = new Map(estimates.map((row) => [String(row.id), row]));
        const seen = new Set<string>();
        const nextRecords = ((signatureResponse.data ?? []) as Array<Record<string, unknown>>)
          .filter((signature) => {
            const estimateId = String(signature.estimate_id || "");
            if (!estimateId || seen.has(estimateId)) return false;
            seen.add(estimateId);
            return true;
          })
          .map((signature) => {
            const estimateId = String(signature.estimate_id);
            const estimate = estimateById.get(estimateId) || {};
            return {
              signatureId: String(signature.id),
              estimateId,
              estimateNumber: String(estimate.estimate_number || "Unassigned"),
              title: String(estimate.title || "Customer Contract"),
              signerName: String(signature.typed_name || "Customer"),
              signedAt: String(signature.signed_at || ""),
              verificationResult: String(signature.verification_result || "verified"),
              versionNumber: Number(signature.estimate_version_number || 1),
              agreementHash: estimate.agreement_hash ? String(estimate.agreement_hash) : null,
            } satisfies SignedContractRecord;
          });

        if (subscribed) {
          setRecords(nextRecords);
          setLoading(false);
        }
      } catch (caught) {
        console.error("Project signed contracts load error:", caught);
        if (subscribed) {
          setError("Unable to load signed contracts right now.");
          setLoading(false);
        }
      }
    };

    void load();
    return () => { subscribed = false; };
  }, [projectId, supabase]);

  return (
    <section className="rounded-[18px] border border-[var(--bos-border-light)] bg-white p-5 shadow-[var(--bos-shadow-workspace-card)]" data-testid="project-signed-contracts">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[var(--orion-blue)]">
            <FileCheck2 size={20} aria-hidden="true" />
            <h2 className="text-xl font-extrabold text-[var(--bos-text-strong-on-light)]">Contracts &amp; Agreements</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm text-[var(--bos-text-medium-on-light)]">
            Permanent customer-signed contract records linked to this project. Operational scope edits never overwrite these signed records.
          </p>
        </div>
        <Badge tone={records.length ? "success" : "neutral"}>{records.length} signed</Badge>
      </div>

      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-[14px] bg-[var(--color-neutral-100)]" />
      ) : error ? (
        <p role="alert" className="mt-4 rounded-[14px] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] p-4 text-sm font-semibold text-[var(--color-danger-700)]">{error}</p>
      ) : records.length ? (
        <div className="mt-4 grid gap-3">
          {records.map((record, index) => (
            <article key={record.signatureId} className="grid gap-4 rounded-[14px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-extrabold text-[var(--bos-text-strong-on-light)]">{index === 0 ? "Original Signed Contract" : "Signed Contract"} · {record.estimateNumber}</p>
                  <Badge tone="success">Verified</Badge>
                </div>
                <p className="mt-1 break-words text-sm font-semibold text-[var(--bos-text-strong-on-light)]">{record.title}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-[var(--bos-text-medium-on-light)]">
                  <span>Signed by {record.signerName}</span>
                  <span>{formatSignedDate(record.signedAt, localeTag)}</span>
                  <span>Version {record.versionNumber}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[var(--bos-text-medium-on-light)]">
                  <ShieldCheck size={13} aria-hidden="true" className="text-[var(--color-success-700)]" />
                  <span>{record.agreementHash ? `Immutable agreement record · ${record.agreementHash.slice(0, 16)}…` : "Immutable signed agreement record retained in B.O.S."}</span>
                </div>
              </div>
              <Link href={`/estimates/${record.estimateId}`} className="shrink-0">
                <Button variant="outline" size="sm">View Signed Contract</Button>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-[14px] border border-dashed border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-4">
          <p className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">No customer-signed contract is linked yet.</p>
          <p className="mt-1 text-xs font-medium text-[var(--bos-text-medium-on-light)]">Once an estimate and incorporated agreement are signed and verified, the permanent signed record will appear here automatically.</p>
        </div>
      )}
    </section>
  );
}

function formatSignedDate(value: string, localeTag: string) {
  if (!value) return "Signed date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Signed date unavailable";
  return `Signed ${new Intl.DateTimeFormat(localeTag, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date)}`;
}
