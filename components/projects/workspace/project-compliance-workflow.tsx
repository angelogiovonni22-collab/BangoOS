"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileCheck2, ShieldCheck } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Select,
} from "@/components/ui";
import { createProjectExecutionService } from "@/lib/projects/execution";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

type ProjectPermitRow = Database["public"]["Tables"]["project_permits"]["Row"];
type ProjectInspectionRow = Database["public"]["Tables"]["project_inspections"]["Row"];
type ProjectCloseoutRow = Database["public"]["Tables"]["project_closeouts"]["Row"];
type ProjectPunchItemRow = Database["public"]["Tables"]["project_punch_items"]["Row"];
type ProjectWarrantyRow = Database["public"]["Tables"]["project_warranties"]["Row"];
type ProjectCloseoutItemRow = Database["public"]["Tables"]["project_closeout_items"]["Row"];

type ExecutionSummary = {
  inspectionsTotal: number;
  inspectionsFailed: number;
  inspectionsUpcoming: number;
  permitsTotal: number;
  permitsOpen: number;
  punchOpen: number;
  closeoutStatus: string;
  closeoutBlockers: Array<Record<string, unknown>>;
  communicationFreshnessAt: string | null;
  communicationStatus: string | null;
};

type CloseoutBundle = {
  closeout: ProjectCloseoutRow | null;
  checklist: ProjectCloseoutItemRow[];
  punchItems: ProjectPunchItemRow[];
  warranties: ProjectWarrantyRow[];
};

type ExecutionService = ReturnType<typeof createProjectExecutionService>;
type SafetyEvidence = { id: string; type: string; description: string; status: string; reportDate: string };
type SafetyEventRow = { id: string; reference_id: string; occurred_at: string; payload: Record<string, unknown> };

const OPEN_PUNCH_STATUSES = new Set(["open", "assigned", "in_progress", "reopened"]);

type ProjectComplianceWorkflowProps = {
  projectId: string;
  workspaceContext: WorkspaceContext;
};

export function ProjectComplianceWorkflow({ projectId, workspaceContext }: ProjectComplianceWorkflowProps) {
  const supabase = useMemo(() => createClient(), []);
  const service = useMemo(() => (supabase ? createProjectExecutionService(supabase) : null), [supabase]);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeMutation, setActiveMutation] = useState<string | null>(null);

  const [summary, setSummary] = useState<ExecutionSummary | null>(null);
  const [permits, setPermits] = useState<ProjectPermitRow[]>([]);
  const [inspections, setInspections] = useState<ProjectInspectionRow[]>([]);
  const [safetyEvidence, setSafetyEvidence] = useState<SafetyEvidence[]>([]);
  const [closeoutBundle, setCloseoutBundle] = useState<CloseoutBundle>({
    closeout: null,
    checklist: [],
    punchItems: [],
    warranties: [],
  });

  const [newPermitType, setNewPermitType] = useState("");
  const [newPermitAuthority, setNewPermitAuthority] = useState("");
  const [selectedPermitId, setSelectedPermitId] = useState("");
  const [permitAction, setPermitAction] = useState("submit");
  const [permitActionDate, setPermitActionDate] = useState("");
  const [permitActionNote, setPermitActionNote] = useState("");

  const [newInspectionType, setNewInspectionType] = useState("");
  const [newInspectionAt, setNewInspectionAt] = useState("");
  const [selectedInspectionId, setSelectedInspectionId] = useState("");
  const [inspectionAction, setInspectionAction] = useState("schedule");
  const [inspectionActionDate, setInspectionActionDate] = useState("");
  const [inspectionActionNote, setInspectionActionNote] = useState("");

  const [newPunchTitle, setNewPunchTitle] = useState("");

  const actorContext = useMemo(() => ({
    companyId: workspaceContext.companyId,
    actorProfileId: workspaceContext.userId,
  }), [workspaceContext.companyId, workspaceContext.userId]);

  const loadCompliance = useCallback(async () => {
    const activeService = getServiceOrThrow(service);

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [permitRows, inspectionRows, closeoutRows, summaryRows, safetyRows] = await Promise.all([
        activeService.listPermits({ ...actorContext, projectId }),
        activeService.listInspections({ ...actorContext, projectId }),
        activeService.listCloseout({ ...actorContext, projectId }),
        activeService.projectExecutionSummary({ ...actorContext, projectId }),
        loadProjectSafetyEvidence(supabase, workspaceContext.companyId, projectId),
      ]);

      setPermits((permitRows || []) as ProjectPermitRow[]);
      setInspections((inspectionRows || []) as ProjectInspectionRow[]);
      setSummary(summaryRows as ExecutionSummary);
      setSafetyEvidence(safetyRows);

      const normalizedCloseout = closeoutRows as CloseoutBundle;
      setCloseoutBundle({
        closeout: normalizedCloseout.closeout || null,
        checklist: normalizedCloseout.checklist || [],
        punchItems: normalizedCloseout.punchItems || [],
        warranties: normalizedCloseout.warranties || [],
      });
    } catch (error) {
      console.error("Failed to load compliance workflow", error);
      setErrorMessage(error instanceof Error ? error.message : "Unable to load compliance workflow.");
    } finally {
      setIsLoading(false);
    }
  }, [actorContext, projectId, service, supabase, workspaceContext.companyId]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadCompliance();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [loadCompliance]);

  const runMutation = useCallback(async (label: string, operation: (activeService: ExecutionService) => Promise<void>) => {
    const activeService = getServiceOrThrow(service);

    setActiveMutation(label);
    setNotice(null);
    setErrorMessage(null);

    try {
      await operation(activeService);
      await loadCompliance();
      setNotice("Compliance workflow updated.");
    } catch (error) {
      console.error("Compliance workflow mutation failed", error);
      setErrorMessage(error instanceof Error ? error.message : "Unable to update compliance workflow.");
    } finally {
      setActiveMutation(null);
    }
  }, [loadCompliance, service]);

  const openPunchItems = closeoutBundle.punchItems.filter((item) => OPEN_PUNCH_STATUSES.has(item.status));
  const overduePermits = permits.filter((permit) => permit.status === "expired" || permit.status === "rejected");
  const openSafetyItems = safetyEvidence.filter((item) => item.status !== "resolved");
  const safetyIncidents = safetyEvidence.filter((item) => item.type === "incident" || item.type === "near_miss");
  const safetyAlerts = (summary?.inspectionsFailed || 0) + overduePermits.length + openSafetyItems.length;
  const warrantyStatus = closeoutBundle.warranties[0]?.status || "inactive";
  const closeoutReadiness = summary?.closeoutStatus || closeoutBundle.closeout?.status || "draft";
  const checklistCompleted = closeoutBundle.checklist.filter((item) => item.completed).length;
  const checklistTotal = closeoutBundle.checklist.length;

  const submitPermitAction = async () => {
    if (!selectedPermitId) {
      setErrorMessage("Select a permit to apply an action.");
      return;
    }

    await runMutation("permit-action", async () => {
      if (permitAction === "submit") {
        const activeService = getServiceOrThrow(service);
        await activeService.submitPermit({ ...actorContext, permitId: selectedPermitId, notes: permitActionNote || null });
        return;
      }

      if (permitAction === "approve") {
        const activeService = getServiceOrThrow(service);
        await activeService.approvePermit({ ...actorContext, permitId: selectedPermitId });
        return;
      }

      if (permitAction === "issue") {
        const activeService = getServiceOrThrow(service);
        await activeService.issuePermit({
          ...actorContext,
          permitId: selectedPermitId,
          expirationDate: permitActionDate || null,
        });
        return;
      }

      if (permitAction === "reject") {
        const activeService = getServiceOrThrow(service);
        await activeService.rejectPermit({
          ...actorContext,
          permitId: selectedPermitId,
          reason: permitActionNote || "Rejected by project team.",
        });
        return;
      }

      if (permitAction === "renewal_required") {
        const activeService = getServiceOrThrow(service);
        await activeService.markPermitRenewalRequired({
          ...actorContext,
          permitId: selectedPermitId,
          notes: permitActionNote || null,
        });
        return;
      }

      if (permitAction === "renew") {
        const activeService = getServiceOrThrow(service);
        await activeService.renewPermit({
          ...actorContext,
          permitId: selectedPermitId,
          expirationDate: permitActionDate || null,
          notes: permitActionNote || null,
        });
        return;
      }

      if (permitAction === "close") {
        const activeService = getServiceOrThrow(service);
        await activeService.closePermit({ ...actorContext, permitId: selectedPermitId });
        return;
      }

      if (permitAction === "expire") {
        const activeService = getServiceOrThrow(service);
        await activeService.expirePermit({ ...actorContext, permitId: selectedPermitId });
        return;
      }

      const activeService = getServiceOrThrow(service);
      await activeService.markPermitNotRequired({
        ...actorContext,
        permitId: selectedPermitId,
        notes: permitActionNote || null,
      });
    });
  };

  const submitInspectionAction = async () => {
    if (!selectedInspectionId) {
      setErrorMessage("Select an inspection to apply an action.");
      return;
    }

    await runMutation("inspection-action", async () => {
      if (inspectionAction === "schedule") {
        const scheduledAt = inspectionActionDate || new Date().toISOString();
        const activeService = getServiceOrThrow(service);
        await activeService.scheduleInspection({ ...actorContext, inspectionId: selectedInspectionId, scheduledAt });
        return;
      }

      if (inspectionAction === "reschedule") {
        const scheduledAt = inspectionActionDate || new Date().toISOString();
        const activeService = getServiceOrThrow(service);
        await activeService.rescheduleInspection({ ...actorContext, inspectionId: selectedInspectionId, scheduledAt });
        return;
      }

      if (inspectionAction === "start") {
        const activeService = getServiceOrThrow(service);
        await activeService.startInspection({ ...actorContext, inspectionId: selectedInspectionId });
        return;
      }

      if (inspectionAction === "pass") {
        const activeService = getServiceOrThrow(service);
        await activeService.passInspection({
          ...actorContext,
          inspectionId: selectedInspectionId,
          notes: inspectionActionNote || null,
        });
        return;
      }

      if (inspectionAction === "fail") {
        const activeService = getServiceOrThrow(service);
        await activeService.failInspection({
          ...actorContext,
          inspectionId: selectedInspectionId,
          correctionNotes: inspectionActionNote || null,
          reinspectionRequired: Boolean(inspectionActionDate),
          reinspectionDate: inspectionActionDate || null,
        });
        return;
      }

      if (inspectionAction === "reinspection_required") {
        const reinspectionDate = inspectionActionDate || new Date().toISOString();
        const activeService = getServiceOrThrow(service);
        await activeService.scheduleReinspection({ ...actorContext, inspectionId: selectedInspectionId, reinspectionDate });
        return;
      }

      const activeService = getServiceOrThrow(service);
      await activeService.cancelInspection({
        ...actorContext,
        inspectionId: selectedInspectionId,
        notes: inspectionActionNote || null,
      });
    });
  };

  const closeoutChecklistProgress = checklistTotal > 0
    ? `${checklistCompleted}/${checklistTotal}`
    : "0/0";

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-section-title font-bold text-[var(--bos-text-strong-on-light)]">Operational Compliance Workflow</CardTitle>
          <CardDescription>
            Unified lifecycle for permits, inspections, punch items, closeout readiness, and warranty activation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage ? <p className="text-sm font-semibold text-[var(--color-danger-700)]">{errorMessage}</p> : null}
          {notice ? <p className="text-sm font-semibold text-[var(--color-success-700)]">{notice}</p> : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard icon={<FileCheck2 size={15} aria-hidden="true" />} label="Permit Status" value={`${summary?.permitsOpen || 0} open`} detail={`${summary?.permitsTotal || 0} total permits`} tone={(summary?.permitsOpen || 0) > 0 ? "warning" : "success"} />
            <MetricCard icon={<ShieldCheck size={15} aria-hidden="true" />} label="Upcoming Inspections" value={`${summary?.inspectionsUpcoming || 0}`} detail={`${summary?.inspectionsTotal || 0} total inspections`} tone={(summary?.inspectionsUpcoming || 0) > 0 ? "info" : "neutral"} />
            <MetricCard icon={<AlertTriangle size={15} aria-hidden="true" />} label="Safety Alerts" value={`${safetyAlerts}`} detail={`${summary?.inspectionsFailed || 0} failed inspections`} tone={safetyAlerts > 0 ? "danger" : "success"} />
            <MetricCard icon={<ClipboardCheck size={15} aria-hidden="true" />} label="Open Punch Items" value={`${summary?.punchOpen || openPunchItems.length}`} detail={`${openPunchItems.length} actionable now`} tone={(summary?.punchOpen || 0) > 0 ? "warning" : "success"} />
            <MetricCard icon={<CheckCircle2 size={15} aria-hidden="true" />} label="Closeout Progress" value={closeoutReadiness.replaceAll("_", " ")} detail={`Checklist ${closeoutChecklistProgress}`} tone={closeoutReadiness === "completed" ? "success" : "info"} />
            <MetricCard icon={<ShieldCheck size={15} aria-hidden="true" />} label="Warranty Status" value={warrantyStatus.replaceAll("_", " ")} detail={closeoutBundle.warranties[0]?.ends_at ? `Ends ${formatDate(closeoutBundle.warranties[0].ends_at)}` : "No end date"} tone={warrantyStatus === "active" ? "success" : "neutral"} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/projects/${projectId}?tab=documents`}>
              <Button variant="outline" size="sm">Review Compliance Documents</Button>
            </Link>
            <Link href={`/projects/${projectId}?tab=photos`}>
              <Button variant="outline" size="sm">Review Photo Evidence</Button>
            </Link>
            <Link href={`/projects/${projectId}?tab=daily_logs`}>
              <Button variant="outline" size="sm">Review Daily Safety Logs</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => void loadCompliance()} isLoading={isLoading}>Refresh Workflow</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-[var(--bos-text-strong-on-light)]">Permit Lifecycle</CardTitle>
            <CardDescription>Create permit records and move them through status transitions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Permit Type">
                <Input value={newPermitType} onChange={(event) => setNewPermitType(event.target.value)} placeholder="Electrical" />
              </FormField>
              <FormField label="Issuing Authority">
                <Input value={newPermitAuthority} onChange={(event) => setNewPermitAuthority(event.target.value)} placeholder="City Building Department" />
              </FormField>
            </div>

            <Button
              size="sm"
              isLoading={activeMutation === "create-permit"}
              disabled={!newPermitType.trim()}
              onClick={() => {
                void runMutation("create-permit", async (activeService) => {
                  await activeService.createPermit({
                    ...actorContext,
                    projectId,
                    permitType: newPermitType.trim(),
                    issuingAuthority: newPermitAuthority.trim() || null,
                  });
                  setNewPermitType("");
                  setNewPermitAuthority("");
                });
              }}
            >
              Add Permit
            </Button>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Permit Record">
                <Select value={selectedPermitId} onChange={(event) => setSelectedPermitId(event.target.value)}>
                  <option value="">Select permit</option>
                  {permits.map((permit) => (
                    <option key={permit.id} value={permit.id}>{permit.permit_type} ({permit.status})</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Action">
                <Select value={permitAction} onChange={(event) => setPermitAction(event.target.value)}>
                  <option value="submit">Submit</option>
                  <option value="approve">Approve</option>
                  <option value="issue">Issue</option>
                  <option value="reject">Reject</option>
                  <option value="renewal_required">Mark Renewal Required</option>
                  <option value="renew">Renew</option>
                  <option value="close">Close</option>
                  <option value="expire">Expire</option>
                  <option value="not_required">Mark Not Required</option>
                </Select>
              </FormField>
              <FormField label="Action Date (optional)">
                <Input type="date" value={permitActionDate} onChange={(event) => setPermitActionDate(event.target.value)} />
              </FormField>
              <FormField label="Notes / Reason">
                <Input value={permitActionNote} onChange={(event) => setPermitActionNote(event.target.value)} placeholder="Optional context" />
              </FormField>
            </div>

            <Button size="sm" variant="secondary" isLoading={activeMutation === "permit-action"} onClick={() => void submitPermitAction()}>
              Apply Permit Action
            </Button>

            <div className="space-y-2">
              {permits.slice(0, 6).map((permit) => (
                <article key={permit.id} className="flex items-center justify-between rounded-[10px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-control)] px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-[var(--bos-text-strong-on-light)]">{permit.permit_type}</p>
                    <p className="text-xs font-medium text-[var(--bos-text-medium-on-light)]">{permit.issuing_authority || "No authority"}</p>
                  </div>
                  <Badge tone={permitTone(permit.status)}>{permit.status.replaceAll("_", " ")}</Badge>
                </article>
              ))}
              {permits.length === 0 ? <p className="text-sm text-[var(--bos-text-medium-on-light)]">No permits tracked yet.</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-bold text-[var(--bos-text-strong-on-light)]">Inspection Lifecycle</CardTitle>
            <CardDescription>Track required inspections and progress each record to completion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Inspection Type">
                <Input value={newInspectionType} onChange={(event) => setNewInspectionType(event.target.value)} placeholder="Foundation" />
              </FormField>
              <FormField label="Scheduled At (optional)">
                <Input type="datetime-local" value={newInspectionAt} onChange={(event) => setNewInspectionAt(event.target.value)} />
              </FormField>
            </div>

            <Button
              size="sm"
              isLoading={activeMutation === "create-inspection"}
              disabled={!newInspectionType.trim()}
              onClick={() => {
                void runMutation("create-inspection", async (activeService) => {
                  await activeService.createInspection({
                    ...actorContext,
                    projectId,
                    inspectionType: newInspectionType.trim(),
                    scheduledAt: newInspectionAt ? new Date(newInspectionAt).toISOString() : null,
                  });
                  setNewInspectionType("");
                  setNewInspectionAt("");
                });
              }}
            >
              Add Inspection
            </Button>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Inspection Record">
                <Select value={selectedInspectionId} onChange={(event) => setSelectedInspectionId(event.target.value)}>
                  <option value="">Select inspection</option>
                  {inspections.map((inspection) => (
                    <option key={inspection.id} value={inspection.id}>{inspection.inspection_type} ({inspection.status})</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Action">
                <Select value={inspectionAction} onChange={(event) => setInspectionAction(event.target.value)}>
                  <option value="schedule">Schedule</option>
                  <option value="reschedule">Reschedule</option>
                  <option value="start">Start</option>
                  <option value="pass">Pass</option>
                  <option value="fail">Fail</option>
                  <option value="reinspection_required">Set Reinspection</option>
                  <option value="cancel">Cancel</option>
                </Select>
              </FormField>
              <FormField label="Action Date (optional)">
                <Input type="datetime-local" value={inspectionActionDate} onChange={(event) => setInspectionActionDate(event.target.value)} />
              </FormField>
              <FormField label="Notes / Corrections">
                <Input value={inspectionActionNote} onChange={(event) => setInspectionActionNote(event.target.value)} placeholder="Optional context" />
              </FormField>
            </div>

            <Button size="sm" variant="secondary" isLoading={activeMutation === "inspection-action"} onClick={() => void submitInspectionAction()}>
              Apply Inspection Action
            </Button>

            <div className="space-y-2">
              {inspections.slice(0, 6).map((inspection) => (
                <article key={inspection.id} className="flex items-center justify-between rounded-[10px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-control)] px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-[var(--bos-text-strong-on-light)]">{inspection.inspection_type}</p>
                    <p className="text-xs font-medium text-[var(--bos-text-medium-on-light)]">{inspection.scheduled_at ? formatDate(inspection.scheduled_at) : "Not scheduled"}</p>
                  </div>
                  <Badge tone={inspectionTone(inspection.status)}>{inspection.status.replaceAll("_", " ")}</Badge>
                </article>
              ))}
              {inspections.length === 0 ? <p className="text-sm text-[var(--bos-text-medium-on-light)]">No inspections tracked yet.</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-[var(--bos-text-strong-on-light)]">Safety Execution Evidence</CardTitle>
          <CardDescription>Project-scoped safety observations from submitted Daily Reports. Daily Reports remain the system of record.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard icon={<ShieldCheck size={15} aria-hidden="true" />} label="Safety Records" value={String(safetyEvidence.length)} detail="Reported field observations" tone="info" />
            <MetricCard icon={<AlertTriangle size={15} aria-hidden="true" />} label="Open Actions" value={String(openSafetyItems.length)} detail="Needs follow-up" tone={openSafetyItems.length ? "warning" : "success"} />
            <MetricCard icon={<AlertTriangle size={15} aria-hidden="true" />} label="Incidents / Near Misses" value={String(safetyIncidents.length)} detail="Recorded in Daily Reports" tone={safetyIncidents.length ? "danger" : "success"} />
          </div>
          <div className="space-y-2">
            {openSafetyItems.slice(0, 8).map((item) => (
              <article key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-control)] px-3 py-2.5">
                <div><p className="text-sm font-semibold text-[var(--bos-text-strong-on-light)]">{item.description}</p><p className="text-xs font-medium text-[var(--bos-text-medium-on-light)]">{item.type.replaceAll("_", " ")} • {formatDate(item.reportDate)}</p></div>
                <Badge tone="warning">{item.status.replaceAll("_", " ")}</Badge>
              </article>
            ))}
            {openSafetyItems.length === 0 ? <p className="text-sm text-[var(--bos-text-medium-on-light)]">No open safety actions in submitted Daily Reports.</p> : null}
          </div>
          <Link href={`/projects/${projectId}?tab=daily_logs`}><Button size="sm" variant="outline">Open Daily Safety Reports</Button></Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold text-[var(--bos-text-strong-on-light)]">Punch, Closeout, and Warranty</CardTitle>
          <CardDescription>Complete field punch and handover readiness before project completion.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Button size="sm" variant="secondary" isLoading={activeMutation === "start-closeout"} onClick={() => {
              void runMutation("start-closeout", async (activeService) => {
                await activeService.startCloseout({ ...actorContext, projectId });
              });
            }}>
              Start Closeout
            </Button>
            <Button size="sm" variant="secondary" isLoading={activeMutation === "walkthrough"} onClick={() => {
              void runMutation("walkthrough", async (activeService) => {
                await activeService.recordWalkthrough({ ...actorContext, projectId });
              });
            }}>
              Record Walkthrough
            </Button>
            <Button size="sm" variant="secondary" isLoading={activeMutation === "handover"} onClick={() => {
              void runMutation("handover", async (activeService) => {
                await activeService.completeHandover({ ...actorContext, projectId });
              });
            }}>
              Complete Handover
            </Button>
            <Button size="sm" variant="outline" isLoading={activeMutation === "refresh-closeout"} onClick={() => void loadCompliance()}>
              Refresh Closeout
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <FormField label="New Punch Item">
              <Input value={newPunchTitle} onChange={(event) => setNewPunchTitle(event.target.value)} placeholder="Install missing handrail" />
            </FormField>
            <div className="flex items-end">
              <Button
                size="sm"
                isLoading={activeMutation === "create-punch"}
                disabled={!newPunchTitle.trim()}
                onClick={() => {
                  void runMutation("create-punch", async () => {
                    const activeService = getServiceOrThrow(service);
                    await activeService.createPunchItem({
                      ...actorContext,
                      projectId,
                      title: newPunchTitle.trim(),
                    });
                    setNewPunchTitle("");
                  });
                }}
              >
                Add Punch Item
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {openPunchItems.slice(0, 8).map((item) => (
              <article key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-[var(--bos-border-light)] bg-[var(--bos-bg-control)] px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-[var(--bos-text-strong-on-light)]">{item.title}</p>
                  <p className="text-xs font-medium text-[var(--bos-text-medium-on-light)]">{item.priority} priority • {item.status.replaceAll("_", " ")}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={activeMutation === `complete-punch-${item.id}`}
                  onClick={() => {
                        void runMutation(`complete-punch-${item.id}`, async (activeService) => {
                          await activeService.completePunchItem({ ...actorContext, punchItemId: item.id });
                        });
                  }}
                >
                  Mark Complete
                </Button>
              </article>
            ))}
            {openPunchItems.length === 0 ? <p className="text-sm text-[var(--bos-text-medium-on-light)]">No open punch items.</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function permitTone(status: string) {
  if (["closed", "not_required"].includes(status)) {
    return "success" as const;
  }

  if (["expired", "rejected", "cancelled"].includes(status)) {
    return "danger" as const;
  }

  if (["approved", "issued"].includes(status)) {
    return "info" as const;
  }

  return "warning" as const;
}

function inspectionTone(status: string) {
  if (status === "passed") {
    return "success" as const;
  }

  if (["failed", "cancelled"].includes(status)) {
    return "danger" as const;
  }

  if (["scheduled", "in_progress", "reinspection_required"].includes(status)) {
    return "warning" as const;
  }

  return "neutral" as const;
}

function formatDate(value: string | null) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function MetricCard(params: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "info" | "warning" | "danger" | "success";
}) {
  const toneClass: Record<typeof params.tone, string> = {
    neutral: "border-[var(--bos-border-light)] bg-[var(--bos-bg-control)]",
    info: "border-[var(--color-info-200)] bg-[var(--color-info-50)]",
    warning: "border-[var(--color-warning-200)] bg-[var(--color-warning-50)]",
    danger: "border-[var(--color-danger-200)] bg-[var(--color-danger-50)]",
    success: "border-[var(--color-success-200)] bg-[var(--color-success-50)]",
  };

  return (
    <article className={["rounded-[12px] border px-3 py-3", toneClass[params.tone]].join(" ")}>
      <div className="mb-2 flex items-center gap-2 text-[var(--bos-text-medium-on-light)]">
        {params.icon}
        <p className="text-xs font-semibold uppercase tracking-[0.08em]">{params.label}</p>
      </div>
      <p className="text-lg font-bold text-[var(--bos-text-strong-on-light)]">{params.value}</p>
      <p className="mt-1 text-xs font-medium text-[var(--bos-text-medium-on-light)]">{params.detail}</p>
    </article>
  );
}

function getServiceOrThrow(service: ExecutionService | null) {
  if (!service) {
    throw new Error("Supabase client is unavailable.");
  }

  return service;
}

async function loadProjectSafetyEvidence(supabase: ReturnType<typeof createClient>, companyId: string, projectId: string): Promise<SafetyEvidence[]> {
  if (!supabase) return [];
  const db = supabase as unknown as { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => unknown } } };
  const response = await (db.from("workflow_events").select("id, reference_id, occurred_at, payload") as unknown as {
    eq: (column: string, value: string) => { eq: (column: string, value: string) => { order: (column: string, options: { ascending: boolean }) => Promise<{ data: Array<{ id: string; reference_id: string; occurred_at: string; payload: Record<string, unknown> }> | null; error: { message: string } | null }> } };
  }).eq("company_id", companyId).eq("reference_entity", "daily_report").order("occurred_at", { ascending: false });
  if (response.error) throw new Error(response.error.message);

  const latestByReport = new Map<string, SafetyEventRow>();
  for (const row of response.data || []) if (!latestByReport.has(row.reference_id)) latestByReport.set(row.reference_id, row);

  return Array.from(latestByReport.values()).flatMap((row) => {
    const report = row.payload?.report as { header?: { projectId?: string; date?: string; reportDate?: string }; safety?: Array<{ id?: string; type?: string; notes?: string; description?: string; status?: string }> } | undefined;
    if (report?.header?.projectId !== projectId) return [];
    return (report.safety || []).map((item, index) => ({
      id: item.id || `${row.id}-${index}`,
      type: item.type || "observation",
      description: item.notes || item.description || "Safety observation",
      status: item.status || "open",
      reportDate: report.header?.date || report.header?.reportDate || row.occurred_at,
    }));
  });
}
