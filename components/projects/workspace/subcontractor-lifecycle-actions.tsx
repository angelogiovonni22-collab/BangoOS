"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Dialog, Input, Select } from "@/components/ui";
import { createVendorsService, type VendorOption } from "@/lib/vendors/service";

type LifecycleAction = "end" | "remove" | "replace" | "terminate" | "rate" | "delete_mistake";
type LifecyclePayload = {
  assignment?: {
    vendor_id?: string;
    assignment_status?: string;
    lifecycle_status?: string;
    lifecycle_reason?: string | null;
    lifecycle_ended_at?: string | null;
  };
  review?: {
    quality?: number;
    schedule_reliability?: number;
    communication?: number;
    safety_compliance?: number;
    professionalism?: number;
    overall_rating?: number;
    comments?: string | null;
  } | null;
  vendorPerformance?: {
    performance_rating?: number | null;
    performance_review_count?: number | null;
    rehire_status?: string | null;
  } | null;
  error?: string;
};

type RatingForm = {
  quality: string;
  scheduleReliability: string;
  communication: string;
  safetyCompliance: string;
  professionalism: string;
  comments: string;
};

const EMPTY_RATING: RatingForm = {
  quality: "5",
  scheduleReliability: "5",
  communication: "5",
  safetyCompliance: "5",
  professionalism: "5",
  comments: "",
};

export function SubcontractorLifecycleActions({ projectId, assignmentId }: { projectId: string; assignmentId: string }) {
  const vendorsService = useMemo(() => createVendorsService(), []);
  const [payload, setPayload] = useState<LifecyclePayload | null>(null);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [activeAction, setActiveAction] = useState<LifecycleAction | null>(null);
  const [reason, setReason] = useState("");
  const [replacementVendorId, setReplacementVendorId] = useState("");
  const [rehireStatus, setRehireStatus] = useState("review_before_assignment");
  const [rating, setRating] = useState<RatingForm>(EMPTY_RATING);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [response, vendorRows] = await Promise.all([
      fetch(`/api/projects/${encodeURIComponent(projectId)}/subcontractors/${encodeURIComponent(assignmentId)}/lifecycle`, { cache: "no-store" }),
      vendorsService.listVendorOptions(),
    ]);
    const body = await response.json() as LifecyclePayload;
    if (!response.ok) throw new Error(body.error || "Unable to load Trade Partner lifecycle.");
    setPayload(body);
    setVendors(vendorRows);
    if (body.review) {
      setRating({
        quality: String(body.review.quality || 5),
        scheduleReliability: String(body.review.schedule_reliability || 5),
        communication: String(body.review.communication || 5),
        safetyCompliance: String(body.review.safety_compliance || 5),
        professionalism: String(body.review.professionalism || 5),
        comments: body.review.comments || "",
      });
    }
  }, [assignmentId, projectId, vendorsService]);

  useEffect(() => {
    let active = true;
    void load().catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : "Unable to load Trade Partner lifecycle.");
    });
    return () => { active = false; };
  }, [load]);

  const currentVendorId = payload?.assignment?.vendor_id || "";
  const lifecycleStatus = payload?.assignment?.lifecycle_status || "active";
  const isClosed = lifecycleStatus !== "active" || payload?.assignment?.assignment_status === "archived";
  const ratingAverage = payload?.vendorPerformance?.performance_rating == null ? null : Number(payload.vendorPerformance.performance_rating);
  const reviewCount = Number(payload?.vendorPerformance?.performance_review_count || 0);
  const rehire = payload?.vendorPerformance?.rehire_status || "approved";
  const replacementOptions = vendors.filter((vendor) => vendor.id !== currentVendorId && vendor.rehireStatus !== "do_not_rehire");

  const openAction = (action: LifecycleAction) => {
    setActiveAction(action);
    setReason("");
    setReplacementVendorId("");
    setMessage(null);
  };

  const closeAction = () => {
    if (busy) return;
    setActiveAction(null);
    setMessage(null);
  };

  async function post(body: Record<string, unknown>) {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/subcontractors/${encodeURIComponent(assignmentId)}/lifecycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json() as { error?: string; replacementAssignmentId?: string };
    if (!response.ok) throw new Error(result.error || "Unable to update Trade Partner assignment.");
    return result;
  }

  async function submitAction() {
    if (!activeAction) return;
    if (["remove", "replace", "terminate"].includes(activeAction) && !reason.trim()) {
      setMessage("Enter a reason before continuing.");
      return;
    }
    if (activeAction === "replace" && !replacementVendorId) {
      setMessage("Select the replacement Trade Partner.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      if (activeAction === "rate") {
        await post({ action: "rate", ...rating });
        setMessage("Trade Partner rating saved.");
        await load();
        setActiveAction(null);
        return;
      }

      if (activeAction === "replace") {
        const result = await post({ action: "replace_vendor", replacementVendorId, reason: reason.trim() });
        setMessage(result.replacementAssignmentId
          ? "Replacement assignment created. Review its compensation and send the new agreement before mobilization."
          : "Replacement assignment created.");
      } else if (activeAction === "terminate") {
        await post({ action: "terminate", reason: reason.trim(), rehireStatus });
        setMessage("Trade Partner removed from the project and termination history preserved.");
      } else if (activeAction === "delete_mistake") {
        if (!window.confirm("Delete this mistaken assignment? This is only allowed when no contract or operational history exists.")) return;
        await post({ action: "delete_mistake" });
        setMessage("Mistaken assignment deleted.");
      } else {
        await post({ action: activeAction, reason: reason.trim() || null });
        setMessage(activeAction === "end" ? "Assignment ended and historical records preserved." : "Trade Partner removed from this project.");
      }

      setActiveAction(null);
      await load();
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update Trade Partner assignment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[14px] border border-[var(--bos-border-light)] bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">Trade Partner Performance</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-lg font-black text-[var(--bos-text-strong-on-light)]">{ratingAverage == null ? "Not rated" : `${ratingAverage.toFixed(1)} ★`}</p>
            {reviewCount > 0 ? <span className="text-xs font-semibold text-[var(--bos-text-medium-on-light)]">{reviewCount} completed {reviewCount === 1 ? "review" : "reviews"}</span> : null}
          </div>
        </div>
        <Badge tone={rehire === "do_not_rehire" ? "danger" : rehire === "review_before_assignment" ? "warning" : "success"}>{pretty(rehire)}</Badge>
      </div>

      {isClosed ? (
        <div className="rounded-lg border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2 text-xs font-semibold text-[var(--bos-text-medium-on-light)]">
          Assignment outcome: <strong className="text-[var(--bos-text-strong-on-light)]">{pretty(lifecycleStatus)}</strong>
          {payload?.assignment?.lifecycle_reason ? ` · ${payload.assignment.lifecycle_reason}` : ""}
        </div>
      ) : (
        <p className="text-xs font-medium leading-5 text-[var(--bos-text-medium-on-light)]">When the project is marked complete, B.O.S. automatically removes this project from the Trade Partner&apos;s active portal while preserving the full history.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {!isClosed ? <Button type="button" size="sm" variant="outline" onClick={() => openAction("end")}>End Assignment</Button> : null}
        {!isClosed ? <Button type="button" size="sm" variant="outline" onClick={() => openAction("remove")}>Remove from Project</Button> : null}
        {!isClosed ? <Button type="button" size="sm" variant="outline" onClick={() => openAction("replace")}>Replace Trade Partner</Button> : null}
        {!isClosed ? <Button type="button" size="sm" variant="outline" onClick={() => openAction("terminate")}>Terminate / Fire</Button> : null}
        {isClosed ? <Button type="button" size="sm" onClick={() => openAction("rate")}>{payload?.review ? "Update Rating" : "Rate Trade Partner"}</Button> : null}
      </div>

      {!isClosed ? (
        <details>
          <summary className="cursor-pointer text-xs font-bold text-[var(--bos-text-medium-on-light)]">Mistaken assignment</summary>
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
            Delete is only for an assignment created by mistake with no signed contract, mobilization, messages, payments, or other history.
            <Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={() => openAction("delete_mistake")}>Delete Mistaken Assignment</Button>
          </div>
        </details>
      ) : null}

      {message && !activeAction ? <p className="text-xs font-semibold text-[var(--bos-text-medium-on-light)]">{message}</p> : null}

      <Dialog open={Boolean(activeAction)} onClose={closeAction} ariaLabel={activeAction ? actionTitle(activeAction) : "Trade Partner action"} backdropLabel="Close Trade Partner action" panelClassName="max-w-xl rounded-[var(--radius-2xl)] p-5">
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-black text-[var(--color-text-primary)]">{activeAction ? actionTitle(activeAction) : "Trade Partner Action"}</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{activeAction ? actionDescription(activeAction) : ""}</p>
          </div>

          {activeAction === "rate" ? (
            <div className="space-y-3">
              <RatingField label="Quality" value={rating.quality} onChange={(value) => setRating((current) => ({ ...current, quality: value }))} />
              <RatingField label="Schedule Reliability" value={rating.scheduleReliability} onChange={(value) => setRating((current) => ({ ...current, scheduleReliability: value }))} />
              <RatingField label="Communication" value={rating.communication} onChange={(value) => setRating((current) => ({ ...current, communication: value }))} />
              <RatingField label="Safety / Compliance" value={rating.safetyCompliance} onChange={(value) => setRating((current) => ({ ...current, safetyCompliance: value }))} />
              <RatingField label="Professionalism" value={rating.professionalism} onChange={(value) => setRating((current) => ({ ...current, professionalism: value }))} />
              <label className="space-y-1.5 text-sm font-bold">Review notes<textarea className="min-h-24 w-full rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3 py-2 font-medium" value={rating.comments} onChange={(event) => setRating((current) => ({ ...current, comments: event.currentTarget.value }))} /></label>
            </div>
          ) : null}

          {activeAction === "replace" ? (
            <label className="space-y-1.5 text-sm font-bold">Replacement Trade Partner<Select value={replacementVendorId} onChange={(event) => setReplacementVendorId(event.currentTarget.value)}><option value="">Select Trade Partner</option>{replacementOptions.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.displayName} · {ratingLabel(vendor)}</option>)}</Select></label>
          ) : null}

          {activeAction === "terminate" ? (
            <label className="space-y-1.5 text-sm font-bold">Future assignment status<Select value={rehireStatus} onChange={(event) => setRehireStatus(event.currentTarget.value)}><option value="review_before_assignment">Review Before Assignment</option><option value="do_not_rehire">Do Not Rehire</option><option value="approved">Approved / Eligible</option></Select></label>
          ) : null}

          {activeAction && !["rate", "delete_mistake"].includes(activeAction) ? (
            <label className="space-y-1.5 text-sm font-bold">{activeAction === "end" ? "Completion notes (optional)" : "Reason (required)"}<Input value={reason} onChange={(event) => setReason(event.currentTarget.value)} placeholder={activeAction === "end" ? "Scope completed" : "Enter the reason"} /></label>
          ) : null}

          {message && activeAction ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{message}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closeAction} disabled={busy}>Cancel</Button>
            <Button type="button" onClick={() => void submitAction()} disabled={busy}>{busy ? "Saving…" : activeAction === "delete_mistake" ? "Delete Assignment" : "Confirm"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function RatingField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid grid-cols-[1fr_120px] items-center gap-3 text-sm font-bold"><span>{label}</span><Select value={value} onChange={(event) => onChange(event.currentTarget.value)}>{[5,4,3,2,1].map((score) => <option key={score} value={score}>{score} ★</option>)}</Select></label>;
}

function pretty(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function actionTitle(action: LifecycleAction) {
  if (action === "end") return "End Assignment";
  if (action === "remove") return "Remove from Project";
  if (action === "replace") return "Replace Trade Partner";
  if (action === "terminate") return "Terminate / Fire Trade Partner";
  if (action === "rate") return "Trade Partner Rating";
  return "Delete Mistaken Assignment";
}

function actionDescription(action: LifecycleAction) {
  if (action === "end") return "Use this when the Trade Partner finished their scope before the overall project is complete. B.O.S. preserves the full history and removes active project access after closeout requirements are satisfied.";
  if (action === "remove") return "Use this when the Trade Partner needs to come off the job. Their B.O.S. company profile remains active and all project history is preserved.";
  if (action === "replace") return "B.O.S. will remove the current Trade Partner from active project access and create a draft replacement assignment with the same trade, scope, and remaining schedule. Review compensation and send the replacement agreement before mobilization.";
  if (action === "terminate") return "Use this for a performance or contractual removal. Access to this project ends immediately, history is preserved, and you can flag whether the company should be reviewed or blocked from future assignments.";
  if (action === "rate") return "Rate the Trade Partner across the factors that matter for future project selection. B.O.S. rolls these reviews into the company-wide star rating.";
  return "Delete only when this assignment was created by mistake and has no operational or contract history.";
}

function ratingLabel(vendor: VendorOption) {
  const score = vendor.performanceRating == null ? "Not rated" : `${vendor.performanceRating.toFixed(1)} ★`;
  const status = vendor.rehireStatus === "review_before_assignment" ? "Review" : "Eligible";
  return `${score} · ${status}`;
}
