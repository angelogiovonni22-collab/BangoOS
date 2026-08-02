import { buildBusinessSignal } from "./pipeline";
import type { BusinessSignalInput } from "./types";

const FIXTURE_TIME = "2026-08-02T09:00:00.000Z";

const fixtureInputs: BusinessSignalInput[] = [
  {
    category: "Workforce",
    severity: "high",
    observation: "Crew Alpha has not submitted required shift update.",
    evidence: [
      { id: "wf-1", label: "Crew submitted no log", value: "No shift log in last 12h", source: "daily-reports", observedAt: FIXTURE_TIME },
      { id: "wf-2", label: "No time entry", value: "No crew timecard posted", source: "timekeeping", observedAt: FIXTURE_TIME },
      { id: "wf-3", label: "No photos", value: "No photo upload for active phase", source: "sitecam", observedAt: FIXTURE_TIME },
      { id: "wf-4", label: "GPS inactive", value: "No geofence ping", source: "telematics", observedAt: FIXTURE_TIME },
      { id: "wf-5", label: "Recent weather normal", value: "No weather disruption signals", source: "weather", observedAt: FIXTURE_TIME },
    ],
    missingInformation: ["Missing crew update"],
    freshness: "partial",
    createdAt: FIXTURE_TIME,
    recommendationHint: "Review missing crew update",
  },
  {
    category: "Weather",
    severity: "medium",
    observation: "Afternoon wind threshold may delay one exterior lift.",
    evidence: [
      { id: "we-1", label: "Forecast wind increase", value: "Projected > 25 mph at 15:00", source: "weather", observedAt: FIXTURE_TIME },
      { id: "we-2", label: "Lift dependency window", value: "Exterior lift tied to single crane slot", source: "schedule", observedAt: FIXTURE_TIME },
    ],
    missingInformation: ["No weather received from one remote station"],
    freshness: "partial",
    createdAt: FIXTURE_TIME,
    recommendationHint: "Inspect weather fallback plan",
  },
  {
    category: "Equipment",
    severity: "high",
    observation: "Required crane inspection is overdue before next lift block.",
    evidence: [
      { id: "eq-1", label: "Inspection interval exceeded", value: "Overdue by 3 days", source: "equipment", observedAt: FIXTURE_TIME },
      { id: "eq-2", label: "Scheduled lift dependency", value: "Crane needed at 14:00", source: "schedule", observedAt: FIXTURE_TIME },
    ],
    missingInformation: ["Awaiting inspector confirmation"],
    freshness: "live",
    createdAt: FIXTURE_TIME,
    recommendationHint: "Review inspection readiness",
  },
  {
    category: "Customer",
    severity: "medium",
    observation: "Customer approval is pending for a change-order milestone.",
    evidence: [
      { id: "cu-1", label: "Approval request open", value: "Pending for 36 hours", source: "change-orders", observedAt: FIXTURE_TIME },
      { id: "cu-2", label: "Milestone dependency", value: "Phase handoff requires approval", source: "projects", observedAt: FIXTURE_TIME },
    ],
    missingInformation: ["Awaiting customer response"],
    freshness: "live",
    createdAt: FIXTURE_TIME,
    recommendationHint: "Review customer follow-up",
  },
  {
    category: "Safety",
    severity: "critical",
    observation: "Safety inspection certificate has expired for active zone.",
    evidence: [
      { id: "sa-1", label: "Inspection expired", value: "Certificate expired yesterday", source: "safety", observedAt: FIXTURE_TIME },
      { id: "sa-2", label: "Active zone occupancy", value: "14 workers assigned", source: "workforce", observedAt: FIXTURE_TIME },
    ],
    missingInformation: ["Inspection pending"],
    freshness: "live",
    createdAt: FIXTURE_TIME,
    recommendationHint: "Review immediate safety escalation",
  },
  {
    category: "Schedule",
    severity: "high",
    observation: "Material delivery is late and compressing sequence buffer.",
    evidence: [
      { id: "sc-1", label: "Delivery late", value: "65 minutes behind ETA", source: "materials", observedAt: FIXTURE_TIME },
      { id: "sc-2", label: "Critical path dependency", value: "Concrete prep blocked", source: "schedule", observedAt: FIXTURE_TIME },
    ],
    missingInformation: ["Awaiting supplier response"],
    freshness: "live",
    createdAt: FIXTURE_TIME,
    recommendationHint: "Inspect delivery contingency",
  },
  {
    category: "Productivity",
    severity: "high",
    observation: "Schedule compression detected across two adjacent tasks.",
    evidence: [
      { id: "pr-1", label: "Task overlap increase", value: "Overlap increased by 25%", source: "schedule", observedAt: FIXTURE_TIME },
      { id: "pr-2", label: "Crew idle variation", value: "Idle variance trending up", source: "workforce", observedAt: FIXTURE_TIME },
    ],
    missingInformation: ["Missing crew update", "Inspection pending"],
    freshness: "partial",
    createdAt: FIXTURE_TIME,
    recommendationHint: "Review compression mitigation",
  },
  {
    category: "Financial",
    severity: "medium",
    observation: "Invoice approval delay is extending expected billing cycle.",
    evidence: [
      { id: "fi-1", label: "Approval delay", value: "Invoice pending 4 business days", source: "invoices", observedAt: FIXTURE_TIME },
      { id: "fi-2", label: "Downstream dependency", value: "Cashflow forecast waiting approval state", source: "financials", observedAt: FIXTURE_TIME },
    ],
    missingInformation: ["Awaiting approver response"],
    freshness: "live",
    createdAt: FIXTURE_TIME,
    recommendationHint: "Review invoice approval blocker",
  },
];

export function buildBusinessSignalFixtures() {
  return fixtureInputs.map((input) => buildBusinessSignal(input));
}
