"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, HardHat, Mail, Phone, Truck, Users } from "./crew-icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMobileFieldOperations } from "@/lib/crews/use-mobile-field-operations";
import type { CrewCheckInAction, DailyChecklist, MobileDailyReportDraft } from "@/lib/crews/mobile-field-operations-types";
import { isFieldProductionValid } from "@/lib/crews/field-production";
import { FieldPhotoCapture } from "./field-photo-capture";
import { MobileFieldInspections } from "./mobile-field-inspections";

const CHECK_IN_ACTIONS: Array<{ action: CrewCheckInAction; label: string }> = [
  { action: "start_shift", label: "Start Shift" },
  { action: "end_shift", label: "End Shift" },
  { action: "break", label: "Break" },
  { action: "lunch", label: "Lunch" },
  { action: "return_to_work", label: "Return To Work" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function MobileFieldOperationsWorkspace() {
  const {
    data,
    isLoading,
    isMutating,
    errorMessage,
    actionMessage,
    refresh,
    createEmptyChecklist,
    createEmptyMobileDailyReportDraft,
    runCheckInAction,
    saveChecklist,
    submitMobileDailyReport,
    checkoutEquipment,
    returnEquipment,
    retryOfflineAction,
    discardOfflineAction,
  } = useMobileFieldOperations();

  const [selectedCrewId, setSelectedCrewId] = useState("");
  const [checklistDraftByCrewId, setChecklistDraftByCrewId] = useState<Record<string, DailyChecklist>>({});
  const [mobileReport, setMobileReport] = useState<MobileDailyReportDraft>(createEmptyMobileDailyReportDraft());
  const [reportDate, setReportDate] = useState(todayIso());
  const [equipmentIdsInput, setEquipmentIdsInput] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [returnCheckoutId, setReturnCheckoutId] = useState("");
  const [returnNotes, setReturnNotes] = useState("");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const effectiveCrewId = selectedCrewId || data?.workforce.crewStatus[0]?.crewId || "";

  const checklist = useMemo(
    () => checklistDraftByCrewId[effectiveCrewId] || data?.checklistByCrew[effectiveCrewId] || createEmptyChecklist(),
    [checklistDraftByCrewId, data, effectiveCrewId, createEmptyChecklist],
  );

  const selectedCrew = useMemo(
    () => data?.workforce.crewStatus.find((crew) => crew.crewId === effectiveCrewId) || null,
    [data, effectiveCrewId],
  );

  const selectedCrewAssignments = useMemo(() => {
    if (!data || !effectiveCrewId) {
      return [];
    }

    return data.workforce.dailyAssignments.filter((assignment) => assignment.crewId === effectiveCrewId);
  }, [data, effectiveCrewId]);

  const checklistProgress = useMemo(() => {
    const total = 3;
    const done = Number(checklist.safetyBriefing) + Number(checklist.ppeVerification) + Number(checklist.equipmentInspection);
    return `${done}/${total}`;
  }, [checklist]);

  const queuedCount = useMemo(() => data?.offline.queue.filter((item) => item.status === "queued").length || 0, [data]);
  const savedCount = useMemo(() => data?.offline.queue.filter((item) => item.status === "synced").length || 0, [data]);
  const productionValid = !mobileReport.completedWork.trim() || isFieldProductionValid({
    activity: mobileReport.completedWork,
    quantity: mobileReport.productionQuantity,
    unit: mobileReport.productionUnit,
    percentComplete: mobileReport.productionPercentComplete,
  });

  if (isLoading) {
    return (
      <Card className="mx-auto w-full max-w-3xl border-[var(--border-default)] bg-[var(--surface-raised)] p-5">
        <p className="text-sm text-[var(--text-secondary)]">Loading mobile field operations...</p>
      </Card>
    );
  }

  if (errorMessage) {
    return <ErrorState title="Unable to load mobile field operations" description={errorMessage} />;
  }

  if (!data) {
    return <EmptyState title="No field operations data" description="CrewOS did not return any field data for today." />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 pb-28">
      <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">CrewOS Mobile Field Ops</h1>
            <p className="text-sm text-[var(--text-secondary)]">Foreman and field workflow for one-handed, fast operations.</p>
          </div>
          <Button variant="secondary" size="sm" disabled={isMutating} onClick={() => void refresh()}>Refresh</Button>
        </div>
        {actionMessage ? <p className="mt-2 text-sm font-medium text-[var(--color-success-700)]">{actionMessage}</p> : null}
      </Card>

      <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-4" id="foreman-dashboard">
        <div className="mb-3 flex items-center gap-2">
          <HardHat className="h-4 w-4 text-[var(--text-secondary)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Foreman Dashboard</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Today&apos;s Crew</p>
            <Select value={selectedCrewId} onChange={(event) => setSelectedCrewId(event.target.value)} aria-label="Select crew">
              {data.workforce.crewStatus.map((crew) => (
                <option key={crew.crewId} value={crew.crewId}>{crew.crewName}</option>
              ))}
            </Select>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">Members: {selectedCrew?.employeeCount || 0}</p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Assigned Project</p>
            <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{selectedCrew?.currentProjectName || "Unassigned"}</p>
            <p className="text-xs text-[var(--text-secondary)]">Shift status: {selectedCrew?.shiftStatus || "off_duty"}</p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Today&apos;s Schedule</p>
            <div className="mt-2 space-y-2">
              {selectedCrewAssignments.length === 0 ? <p className="text-xs text-[var(--text-secondary)]">No assignments scheduled.</p> : null}
              {selectedCrewAssignments.map((assignment) => (
                <div key={assignment.assignmentId} className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3 py-2">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{assignment.title}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{assignment.startTime} - {assignment.endTime}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Equipment Assigned</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{selectedCrew?.equipmentAssignedCount || 0}</p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Weather</p>
            <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{data.weather}</p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Daily Checklist</p>
            <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{checklistProgress} completed</p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Quick Actions</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.quickActions.map((action) => (
                <a key={action.id} href={`#${action.id}`} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]">
                  {action.label}
                </a>
              ))}
            </div>
          </div>
        </div>
        {data.offline.conflicts.length ? <div className="mt-3 space-y-2">{data.offline.conflicts.map((conflict) => <div key={conflict.id} className="rounded-[var(--radius-card)] border border-[var(--color-warning-300)] bg-[var(--color-warning-50)] p-3"><p className="text-sm font-semibold text-[var(--text-primary)]">{conflict.entityType.replaceAll("_", " ")}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{conflict.message}</p><div className="mt-2 flex gap-2"><Button size="sm" disabled={isMutating} onClick={() => void retryOfflineAction(conflict.id)}>Retry</Button><Button size="sm" variant="outline" disabled={isMutating} onClick={() => void discardOfflineAction(conflict.id)}>Discard</Button></div></div>)}</div> : null}
      </Card>

      <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-4" id="check-in">
        <div className="mb-3 flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--text-secondary)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Crew Check-In</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {CHECK_IN_ACTIONS.map((item) => (
            <Button
              key={item.action}
              size="lg"
              variant={item.action === "end_shift" ? "danger" : "secondary"}
              disabled={isMutating || !effectiveCrewId}
              onClick={() => void runCheckInAction({ crewId: effectiveCrewId, action: item.action })}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-4" id="field-photos"><FieldPhotoCapture projectId={selectedCrewAssignments[0]?.projectId || ""} projectName={selectedCrewAssignments[0]?.projectName || selectedCrew?.currentProjectName || ""} onUploaded={refresh}/></Card>

      <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-4" id="field-inspections"><MobileFieldInspections projectId={selectedCrewAssignments[0]?.projectId || ""} projectName={selectedCrewAssignments[0]?.projectName || selectedCrew?.currentProjectName || ""}/></Card>

      <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-4" id="checklist">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-[var(--text-secondary)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Daily Checklist</h2>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] px-3 py-3 text-sm font-medium text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={checklist.safetyBriefing}
              onChange={(event) => setChecklistDraftByCrewId((current) => ({
                ...current,
                [effectiveCrewId]: { ...checklist, safetyBriefing: event.target.checked },
              }))}
            />
            Safety briefing
          </label>
          <label className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] px-3 py-3 text-sm font-medium text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={checklist.ppeVerification}
              onChange={(event) => setChecklistDraftByCrewId((current) => ({
                ...current,
                [effectiveCrewId]: { ...checklist, ppeVerification: event.target.checked },
              }))}
            />
            PPE verification
          </label>
          <label className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] px-3 py-3 text-sm font-medium text-[var(--text-primary)]">
            <input
              type="checkbox"
              checked={checklist.equipmentInspection}
              onChange={(event) => setChecklistDraftByCrewId((current) => ({
                ...current,
                [effectiveCrewId]: { ...checklist, equipmentInspection: event.target.checked },
              }))}
            />
            Equipment inspection
          </label>

          <Input
            placeholder="Daily goals"
            value={checklist.dailyGoals}
            onChange={(event) => setChecklistDraftByCrewId((current) => ({
              ...current,
              [effectiveCrewId]: { ...checklist, dailyGoals: event.target.value },
            }))}
          />
          <Textarea
            placeholder="Supervisor notes"
            value={checklist.supervisorNotes}
            onChange={(event) => setChecklistDraftByCrewId((current) => ({
              ...current,
              [effectiveCrewId]: { ...checklist, supervisorNotes: event.target.value },
            }))}
            rows={3}
          />

          <Button fullWidth size="lg" disabled={isMutating || !effectiveCrewId} onClick={() => void saveChecklist({ crewId: effectiveCrewId, checklist })}>Save Checklist</Button>
        </div>
      </Card>

      <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-4" id="mobile-report">
        <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)]">Mobile Daily Report</h2>

        <div className="space-y-3">
          <Input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} />
          <Input
            placeholder="Photos (comma separated filenames)"
            value={mobileReport.photos.join(", ")}
            onChange={(event) => setMobileReport((current) => ({
              ...current,
              photos: event.target.value.split(",").map((entry) => entry.trim()).filter(Boolean),
            }))}
          />
          <Textarea rows={3} placeholder="Notes" value={mobileReport.notes} onChange={(event) => setMobileReport((current) => ({ ...current, notes: event.target.value }))} />
          <Textarea rows={2} placeholder="Completed work" value={mobileReport.completedWork} onChange={(event) => setMobileReport((current) => ({ ...current, completedWork: event.target.value }))} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input aria-label="Production quantity" inputMode="decimal" placeholder="Quantity" value={mobileReport.productionQuantity} onChange={(event) => setMobileReport((current) => ({ ...current, productionQuantity: event.target.value }))} />
            <Input aria-label="Production unit" placeholder="Unit (SF, LF, EA)" value={mobileReport.productionUnit} onChange={(event) => setMobileReport((current) => ({ ...current, productionUnit: event.target.value }))} />
            <Input aria-label="Production percent complete" inputMode="decimal" placeholder="% complete" value={mobileReport.productionPercentComplete} onChange={(event) => setMobileReport((current) => ({ ...current, productionPercentComplete: event.target.value }))} />
          </div>
          {!productionValid ? <p role="alert" className="text-xs text-[var(--color-danger-700)]">Completed work requires a quantity above zero, a unit, and percent complete from 0 to 100.</p> : null}
          <Textarea rows={2} placeholder="Delays" value={mobileReport.delays} onChange={(event) => setMobileReport((current) => ({ ...current, delays: event.target.value }))} />
          <Textarea rows={2} placeholder="Materials used" value={mobileReport.materialsUsed} onChange={(event) => setMobileReport((current) => ({ ...current, materialsUsed: event.target.value }))} />
          <Textarea rows={2} placeholder="Safety observations" value={mobileReport.safetyObservations} onChange={(event) => setMobileReport((current) => ({ ...current, safetyObservations: event.target.value }))} />
          {mobileReport.safetyObservations.trim() ? <div className="grid gap-2 sm:grid-cols-2">
            <Select aria-label="Safety event type" value={mobileReport.safetyEventType} onChange={(event) => setMobileReport((current) => ({ ...current, safetyEventType: event.target.value as MobileDailyReportDraft["safetyEventType"] }))}><option value="inspection">Inspection</option><option value="toolbox_talk">Toolbox talk</option><option value="near_miss">Near miss</option><option value="incident">Incident</option></Select>
            <Select aria-label="Safety severity" value={mobileReport.safetySeverity} onChange={(event) => setMobileReport((current) => ({ ...current, safetySeverity: event.target.value as MobileDailyReportDraft["safetySeverity"] }))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></Select>
            <Textarea className="sm:col-span-2" rows={2} aria-label="Immediate safety action" placeholder="Immediate action taken" value={mobileReport.safetyImmediateAction} onChange={(event) => setMobileReport((current) => ({ ...current, safetyImmediateAction: event.target.value }))} />
          </div> : null}

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="lg"
              variant="outline"
              disabled={isMutating || !effectiveCrewId || !reportDate || !productionValid}
              onClick={() => void submitMobileDailyReport({
                crewId: effectiveCrewId,
                reportDate,
                status: "draft",
                draft: mobileReport,
              })}
            >
              Save Draft
            </Button>
            <Button
              size="lg"
              disabled={isMutating || !effectiveCrewId || !reportDate || !productionValid}
              onClick={() => void submitMobileDailyReport({
                crewId: effectiveCrewId,
                reportDate,
                status: "submitted",
                draft: mobileReport,
              })}
            >
              Submit Report
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-4" id="crew-directory">
        <h2 className="mb-3 text-base font-semibold text-[var(--text-primary)]">Crew Directory</h2>
        <div className="space-y-2">
          {data.crewDirectory.slice(0, 30).map((employee) => {
            const canCall = Boolean(employee.phone);
            const callHref = employee.phone ? `tel:${employee.phone}` : "#";
            const textHref = employee.phone ? `sms:${employee.phone}` : "#";

            return (
              <article key={employee.employeeId} className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{employee.employeeName}</p>
                <p className="text-xs text-[var(--text-secondary)]">Crew: {employee.crewName || "Unassigned"}</p>
                <p className="text-xs text-[var(--text-secondary)]">Project: {employee.projectName || "Unassigned"}</p>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  <a href={callHref} className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)]" aria-disabled={!canCall}>
                    <Phone className="h-4 w-4" />
                  </a>
                  <a href={textHref} className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)]" aria-disabled={!canCall}>
                    <Mail className="h-4 w-4" />
                  </a>
                  <Link href={`/crews/${effectiveCrewId}`} className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-semibold">Crew</Link>
                  <Link href="/projects" className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-subtle)] text-xs font-semibold">Project</Link>
                </div>
              </article>
            );
          })}
        </div>
      </Card>

      <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-4" id="equipment">
        <div className="mb-3 flex items-center gap-2">
          <Truck className="h-4 w-4 text-[var(--text-secondary)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Equipment Checkout</h2>
        </div>

        <div className="space-y-3">
          <Input placeholder="Equipment IDs (comma separated)" value={equipmentIdsInput} onChange={(event) => setEquipmentIdsInput(event.target.value)} />
          <Textarea rows={2} placeholder="Condition notes" value={checkoutNotes} onChange={(event) => setCheckoutNotes(event.target.value)} />
          <Button
            fullWidth
            size="lg"
            disabled={isMutating || !effectiveCrewId || !equipmentIdsInput.trim()}
            onClick={() => void checkoutEquipment({
              crewId: effectiveCrewId,
              equipmentIds: equipmentIdsInput.split(",").map((id) => id.trim()).filter(Boolean),
              conditionNotes: checkoutNotes,
            })}
          >
            Assign Equipment
          </Button>

          <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
            <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Return Equipment</p>
            <Select value={returnCheckoutId} onChange={(event) => setReturnCheckoutId(event.target.value)}>
              <option value="">Select checkout record</option>
              {data.equipmentCheckouts.filter((record) => !record.returnedAt).map((record) => (
                <option key={record.id} value={record.id}>{record.crewId} · {record.equipmentIds.join(", ")}</option>
              ))}
            </Select>
            <Textarea className="mt-2" rows={2} placeholder="Return condition notes" value={returnNotes} onChange={(event) => setReturnNotes(event.target.value)} />
            <Button
              className="mt-2"
              fullWidth
              size="lg"
              variant="secondary"
              disabled={isMutating || !returnCheckoutId}
              onClick={() => void returnEquipment({ checkoutId: returnCheckoutId, conditionNotes: returnNotes })}
            >
              Return Equipment
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-[var(--border-default)] bg-[var(--surface-raised)] p-4" id="offline-architecture">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[var(--text-secondary)]" />
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Offline Architecture</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">Queued items are pending save. Saved items are already persisted and shown for field audit history.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Queue (Pending Save)</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{queuedCount} items</p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Saved Records</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{savedCount} items</p>
          </div>
          <div className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Conflicts</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{data.offline.conflicts.length}</p>
          </div>
        </div>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 md:hidden">
        <div className="grid grid-cols-2 gap-2">
          <Button size="lg" onClick={() => void runCheckInAction({ crewId: effectiveCrewId, action: "start_shift" })} disabled={isMutating || !effectiveCrewId}>Start Shift</Button>
          <Button size="lg" variant="secondary" onClick={() => void runCheckInAction({ crewId: effectiveCrewId, action: "return_to_work" })} disabled={isMutating || !effectiveCrewId}>Return</Button>
        </div>
      </div>

      <div className="hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3 text-xs text-[var(--text-secondary)] md:block">
        Mobile quick actions are pinned on phone view for minimal taps and one-handed operation.
      </div>
    </div>
  );
}
