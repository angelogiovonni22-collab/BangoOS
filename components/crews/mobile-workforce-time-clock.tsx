"use client";

import { useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { recordWorkforceTimeEvent } from "@/lib/crews/workforce-time";

type LocationResult = { location: { latitude: number; longitude: number; accuracy: number } | null; captured: boolean };

function getLocation() {
  return new Promise<LocationResult>((resolve) => {
    if (!navigator.geolocation) {
      resolve({ location: null, captured: false });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ location: { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }, captured: true }),
      () => resolve({ location: null, captured: false }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
    );
  });
}

export function MobileWorkforceTimeClock({ employees, projectId, assignmentId }: {
  employees: Array<{ id: string; name: string }>;
  projectId: string;
  assignmentId: string;
}) {
  const [selected, setSelected] = useState(employees[0]?.id || "");
  const [notes, setNotes] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const mutationRef = useRef(false);
  const hasSelectedEmployee = employees.some((employee) => employee.id === selected);
  const emptyMessage = !assignmentId
    ? "No active assignment is available for this crew today. Ask your supervisor to publish an assignment before recording time."
    : employees.length === 0
      ? "No employees are assigned to this job. Ask your supervisor to update the assignment before recording time."
      : null;

  const run = async (action: "clock_in" | "clock_out") => {
    if (!hasSelectedEmployee || mutationRef.current) return;
    const parsedBreak = Math.floor(Number(breakMinutes) || 0);
    if (action === "clock_out" && (parsedBreak < 0 || parsedBreak > 1440)) {
      setMessage("Break minutes must be between 0 and 1,440.");
      return;
    }
    mutationRef.current = true;
    setBusy(true);
    setMessage("Getting location for this time entry…");
    try {
      const evidence = await getLocation();
      setMessage(action === "clock_in" ? "Saving clock-in…" : "Saving clock-out…");
      await recordWorkforceTimeEvent({ employeeId: selected, action, projectId, assignmentId, notes, location: evidence.location, breakMinutes: action === "clock_out" ? parsedBreak : 0 });
      setMessage(`${action === "clock_in" ? "Clock-in" : "Clock-out"} recorded${evidence.captured ? " with location evidence" : " without location evidence"}.`);
      setNotes("");
      if (action === "clock_out") setBreakMinutes("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record time.");
    } finally {
      mutationRef.current = false;
      setBusy(false);
    }
  };

  return (
    <section data-orion-region="mobile-workforce-time" aria-busy={busy} className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4" />
        <p className="text-sm font-semibold text-[var(--text-primary)]">Workforce time clock</p>
      </div>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">Location is requested only at clock-in/out; continuous tracking is not used.</p>
      {emptyMessage ? <p role="status" className="mt-3 text-sm text-[var(--text-secondary)]">{emptyMessage}</p> : null}
      <Select className="mt-3" aria-label="Employee time clock" disabled={busy || employees.length === 0} value={hasSelectedEmployee ? selected : ""} onChange={(event) => setSelected(event.target.value)}>
        <option value="">{employees.length === 0 ? "No assigned employees" : "Select employee"}</option>
        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
      </Select>
      <Input className="mt-2" aria-label="Time entry notes" placeholder="Optional time note" disabled={busy || employees.length === 0} value={notes} onChange={(event) => setNotes(event.target.value)} />
      <Input className="mt-2" aria-label="Break minutes" inputMode="numeric" placeholder="Break minutes (enter before clock-out)" disabled={busy || employees.length === 0} value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button disabled={!hasSelectedEmployee || busy} onClick={() => void run("clock_in")}>Clock in</Button>
        <Button variant="secondary" disabled={!hasSelectedEmployee || busy} onClick={() => void run("clock_out")}>Clock out</Button>
      </div>
      {message ? <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">{message}</p> : null}
    </section>
  );
}
