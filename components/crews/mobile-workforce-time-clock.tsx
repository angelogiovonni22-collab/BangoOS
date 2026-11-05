"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { getWorkforceClockEntry, recordWorkforceTimeEvent } from "@/lib/crews/workforce-time";
import { formatWorkforceDuration, parseWorkforceClockEntry, workforceLocationFailure, workforceWorkedSeconds, type WorkforceClockEntry } from "@/lib/crews/workforce-clock-state";

type LocationResult = { location: { latitude: number; longitude: number; accuracy: number } | null; failureCode?: number };
function getLocation() {
  return new Promise<LocationResult>((resolve) => {
    if (!navigator.geolocation) { resolve({ location: null }); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ location: { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy } }),
      (error) => resolve({ location: null, failureCode: error.code }),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
    );
  });
}
type ClockRead = { key: string; entry: WorkforceClockEntry | null; error: string | null };

export function MobileWorkforceTimeClock({ employees, projectId, assignmentId }: {
  employees: Array<{ id: string; name: string }>; projectId: string; assignmentId: string;
}) {
  const [selected, setSelected] = useState(employees[0]?.id || "");
  const [notes, setNotes] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [clockRead, setClockRead] = useState<ClockRead | null>(null);
  const [reload, setReload] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const mutationRef = useRef(false);
  const readRequestRef = useRef(0);
  const hasSelectedEmployee = employees.some((employee) => employee.id === selected);
  const selectionKey = `${assignmentId}:${selected}`;
  const current = clockRead?.key === selectionKey ? clockRead : null;
  const entry = current?.entry || null;
  const verified = Boolean(current && !current.error);
  const clockedIn = verified && Boolean(entry && !entry.endedAt);
  const clockedOut = verified && Boolean(entry?.endedAt);
  const canRecord = Boolean(hasSelectedEmployee && assignmentId && projectId && verified && !busy);
  const emptyMessage = !assignmentId
    ? "No active assignment is available for this crew today. Ask your supervisor to publish an assignment before recording time."
    : employees.length === 0 ? "No employees are assigned to this job. Ask your supervisor to update the assignment before recording time." : null;

  useEffect(() => {
    if (!hasSelectedEmployee) return;
    let active = true;
    const request = ++readRequestRef.current;
    void getWorkforceClockEntry(selected).then((saved) => {
      if (active && request === readRequestRef.current) {
        setClockRead({ key: selectionKey, entry: saved, error: null });
        setNow(Date.now());
      }
    }).catch(() => {
      if (active && request === readRequestRef.current) setClockRead({ key: selectionKey, entry: null, error: "Unable to verify the saved clock status. Retry before recording time." });
    });
    return () => { active = false; };
  }, [hasSelectedEmployee, selected, selectionKey, reload]);

  useEffect(() => {
    if (!entry || entry.endedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [entry]);

  const refreshStatus = () => { setClockRead(null); setReload(value => value + 1); };
  const run = async (action: "clock_in" | "clock_out") => {
    if (!canRecord || mutationRef.current || (action === "clock_in" && clockedIn) || (action === "clock_out" && !clockedIn)) return;
    const parsedBreak = Math.floor(Number(breakMinutes) || 0);
    if (action === "clock_out" && (parsedBreak < 0 || parsedBreak > 1440)) { setMessage("Break minutes must be between 0 and 1,440."); return; }
    mutationRef.current = true;
    setBusy(true);
    setMessage("Getting location for this time entry…");
    try {
      const evidence = await getLocation();
      setMessage(action === "clock_in" ? "Saving clock-in…" : "Saving clock-out…");
      const result = await recordWorkforceTimeEvent({ employeeId: selected, action, projectId, assignmentId, notes, location: evidence.location, breakMinutes: action === "clock_out" ? parsedBreak : 0 });
      const saved = parseWorkforceClockEntry(result);
      ++readRequestRef.current;
      if (saved) {
        setClockRead({ key: selectionKey, entry: saved, error: null });
        setNow(Date.now());
      } else refreshStatus();
      setMessage(`${action === "clock_in" ? "Clock-in" : "Clock-out"} recorded. ${evidence.location ? "Location captured." : workforceLocationFailure(evidence.failureCode)}`);
      setNotes("");
      if (action === "clock_out") setBreakMinutes("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record time.");
      refreshStatus();
    } finally {
      mutationRef.current = false;
      setBusy(false);
    }
  };

  const confirmedStyle = (color: string) => ({ backgroundColor: color, backgroundImage: "none", borderColor: color, color: "white", opacity: 1 });
  return (
    <section data-orion-region="mobile-workforce-time" aria-busy={busy} className="rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-default)] p-3">
      <div className="flex items-center gap-2"><Clock className="h-4 w-4" /><p className="text-sm font-semibold text-[var(--text-primary)]">Workforce time clock</p></div>
      <p className="mt-1 text-xs text-[var(--text-secondary)]">Location is requested only at clock-in/out; continuous tracking is not used.</p>
      {emptyMessage ? <p role="status" className="mt-3 text-sm text-[var(--text-secondary)]">{emptyMessage}</p> : null}
      <Select className="mt-3" aria-label="Employee time clock" disabled={busy || employees.length === 0} value={hasSelectedEmployee ? selected : ""} onChange={(event) => { setSelected(event.target.value); setMessage(null); }}>
        <option value="">{employees.length === 0 ? "No assigned employees" : "Select employee"}</option>
        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
      </Select>
      {hasSelectedEmployee && !current ? <p role="status" className="mt-2 text-sm text-[var(--text-secondary)]">Checking saved clock status…</p> : null}
      {current?.error ? <div className="mt-2"><p role="alert" className="text-sm text-[var(--color-danger-700)]">{current.error}</p><Button variant="secondary" disabled={busy} onClick={refreshStatus}>Retry clock status</Button></div> : null}
      {entry ? <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{clockedIn ? "Clocked in" : "Clocked out"}</p>
        <p className="text-xs text-[var(--text-secondary)]">{clockedIn ? "Live time worked" : "Last shift time worked"}</p>
        <p role="timer" aria-label={clockedIn ? "Live time worked" : "Last shift time worked"} className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{formatWorkforceDuration(workforceWorkedSeconds(entry, now))}</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">{entry.endedAt ? `Unpaid break deducted: ${entry.breakMinutes} min.` : "Unpaid breaks are deducted at clock-out."}</p>
      </div> : null}
      <Input className="mt-2" aria-label="Time entry notes" placeholder="Optional time note" disabled={busy || employees.length === 0} value={notes} onChange={(event) => setNotes(event.target.value)} />
      <Input className="mt-2" aria-label="Break minutes" inputMode="numeric" placeholder="Break minutes (enter before clock-out)" disabled={busy || employees.length === 0} value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="secondary" aria-pressed={clockedIn} style={clockedIn ? confirmedStyle("var(--color-success-700)") : undefined} disabled={!canRecord || clockedIn} onClick={() => void run("clock_in")}><span style={clockedIn ? { color: "white" } : undefined}>{clockedIn ? "Clocked in" : "Clock in"}</span></Button>
        <Button variant="secondary" aria-pressed={clockedOut} style={clockedOut ? confirmedStyle("var(--color-danger-700)") : undefined} disabled={!canRecord || !clockedIn} onClick={() => void run("clock_out")}><span style={clockedOut ? { color: "white" } : undefined}>{clockedOut ? "Clocked out" : "Clock out"}</span></Button>
      </div>
      {message ? <p role="status" className="mt-2 text-xs text-[var(--text-secondary)]">{message}</p> : null}
    </section>
  );
}
