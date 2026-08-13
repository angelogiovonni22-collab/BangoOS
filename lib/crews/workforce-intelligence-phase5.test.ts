import {
  createRecommendationFingerprint,
  createTimelineFingerprint,
  createWorkforceIntelligencePersistenceService,
  isValidLifecycleTransition,
  mapScoreSnapshots,
} from "./workforce-intelligence-persistence";
import { evaluateOrionWorkforceIntelligence } from "./workforce-orion-intelligence";
import type { OrionRecommendation, OrionWorkforceScore, WorkforceTimelineEvent } from "./workforce-operations-types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

type Row = Record<string, unknown>;

class MockBuilder {
  private readonly db: Record<string, Row[]>;
  private readonly table: string;
  private mode: "select" | "insert" | "update" = "select";
  private filters: Array<{ op: "eq" | "in" | "gte"; column: string; value: unknown }> = [];
  private orders: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private payload: Row[] = [];

  constructor(db: Record<string, Row[]>, table: string) {
    this.db = db;
    this.table = table;
  }

  select() {
    if (this.mode !== "insert" && this.mode !== "update") {
      this.mode = "select";
    }
    return this;
  }

  insert(value: Row | Row[]) {
    this.mode = "insert";
    this.payload = Array.isArray(value) ? value : [value];
    return this;
  }

  update(value: Row) {
    this.mode = "update";
    this.payload = [value];
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ op: "in", column, value: values });
    return this;
  }

  gte(column: string, value: string) {
    this.filters.push({ op: "gte", column, value });
    return this;
  }

  order(column: string, options: { ascending: boolean }) {
    this.orders.push({ column, ascending: options.ascending });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  async single() {
    const rows = await this.execute();
    return { data: rows[0] || null, error: null };
  }

  async maybeSingle() {
    const rows = await this.execute();
    return { data: rows[0] || null, error: null };
  }

  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then((rows) => ({ data: rows, error: null as null })).then(onfulfilled, onrejected);
  }

  private async execute() {
    const tableRows = this.db[this.table] || [];

    if (this.mode === "insert") {
      const inserted = this.payload.map((row, index) => {
        const next: Row = {
          id: row.id || `${this.table}-${tableRows.length + index + 1}`,
          created_at: row.created_at || new Date().toISOString(),
          updated_at: row.updated_at || new Date().toISOString(),
          ...row,
        };

        tableRows.push(next);
        return next;
      });

      this.db[this.table] = tableRows;
      return inserted;
    }

    if (this.mode === "update") {
      const rows = this.applyFilters(tableRows);
      const patch = this.payload[0] || {};
      for (const row of rows) {
        Object.assign(row, patch, { updated_at: new Date().toISOString() });
      }
      return rows;
    }

    let rows = this.applyFilters(tableRows);

    for (const order of this.orders) {
      rows = [...rows].sort((left, right) => {
        const a = left[order.column];
        const b = right[order.column];

        if (a === b) {
          return 0;
        }

        if (typeof a === "string" && typeof b === "string") {
          return order.ascending ? a.localeCompare(b) : b.localeCompare(a);
        }

        return 0;
      });
    }

    if (typeof this.limitCount === "number") {
      rows = rows.slice(0, this.limitCount);
    }

    return rows;
  }

  private applyFilters(input: Row[]) {
    return input.filter((row) => this.filters.every((filter) => {
      const value = row[filter.column];
      if (filter.op === "eq") {
        return value === filter.value;
      }

      if (filter.op === "in") {
        const values = filter.value as unknown[];
        return values.includes(value);
      }

      if (filter.op === "gte") {
        return typeof value === "string" && typeof filter.value === "string" && value >= filter.value;
      }

      return true;
    }));
  }
}

class MockSupabase {
  private readonly db: Record<string, Row[]>;

  constructor(db: Record<string, Row[]>) {
    this.db = db;
  }

  from(table: string) {
    return new MockBuilder(this.db, table);
  }

  snapshot(table: string) {
    return [...(this.db[table] || [])];
  }
}

function makeEvaluatorFixture() {
  return {
    summary: {
      activeEmployees: 3,
      activeCrews: 2,
      employeesClockedIn: 2,
      employeesOffToday: 0,
      employeesLate: 1,
      employeesAbsent: 1,
      openAssignments: 2,
      averageCrewUtilization: 70,
    },
    crewStatus: [
      {
        crewId: "crew-a",
        crewName: "Crew A",
        supervisorName: null,
        currentProjectName: "Tower Build",
        employeeCount: 2,
        status: "working",
        shiftStatus: "working",
        shiftProgressPercent: 50,
        equipmentAssignedCount: 0,
        assignmentStatus: "in_progress",
      },
      {
        crewId: "crew-b",
        crewName: "Crew B",
        supervisorName: "Supervisor B",
        currentProjectName: "Tower Build",
        employeeCount: 4,
        status: "off_duty",
        shiftStatus: "off_duty",
        shiftProgressPercent: 0,
        equipmentAssignedCount: 1,
        assignmentStatus: "planned",
      },
    ],
    employeeStatus: [
      {
        employeeId: "emp-1",
        employeeName: "Alex",
        currentStatus: "available",
        assignedCrewId: null,
        assignedCrewName: null,
        assignedProjectId: null,
        assignedJobName: null,
        timeTodayHours: 2,
        overtime: false,
        lastCheckIn: null,
        contactPhone: null,
      },
      {
        employeeId: "emp-2",
        employeeName: "Jordan",
        currentStatus: "working",
        assignedCrewId: "crew-a",
        assignedCrewName: "Crew A",
        assignedProjectId: "project-1",
        assignedJobName: "Task 1",
        timeTodayHours: 9,
        overtime: true,
        lastCheckIn: "2026-08-07T08:00:00.000Z",
        contactPhone: null,
      },
      {
        employeeId: "emp-3",
        employeeName: "Morgan",
        currentStatus: "absent",
        assignedCrewId: "crew-b",
        assignedCrewName: "Crew B",
        assignedProjectId: "project-2",
        assignedJobName: "Task 2",
        timeTodayHours: 0,
        overtime: false,
        lastCheckIn: null,
        contactPhone: null,
      },
    ],
    projectStaffing: [
      {
        projectId: "project-1",
        projectName: "Tower Build",
        requiredWorkers: 8,
        assignedWorkers: 4,
        staffingHealth: "risk",
        openPositions: 4,
        laborBudget: null,
        atRisk: true,
      },
    ],
    projectOperations: [
      {
        projectId: "project-1",
        projectName: "Tower Build",
        crewAssigned: 1,
        requiredWorkers: 8,
        missingWorkers: 4,
        equipmentAssigned: 0,
        scheduleStatus: "at_risk",
        laborProgress: 50,
      },
    ],
    overdueItems: {
      lateEmployees: [{ employeeId: "emp-1", employeeName: "Alex" }],
      missingCheckIns: [],
      missingAssignments: [],
      safetyFlags: [{ assignmentId: "as-1", assignmentTitle: "Task 1" }],
      missingEquipment: [{ crewId: "crew-a", crewName: "Crew A" }],
    },
    assignmentConflicts: [
      {
        id: "conf-1",
        severity: "critical",
        type: "crew_overlap",
        title: "Crew overlap conflict",
        explanation: "Crew overlap",
        relatedProjectId: "project-1",
        relatedCrewId: "crew-a",
        relatedEmployeeId: "emp-1",
        resolutionStatus: "open",
      },
      {
        id: "conf-2",
        severity: "medium",
        type: "understaffed",
        title: "Understaffed assignment",
        explanation: "Need workers",
        relatedProjectId: "project-1",
        relatedCrewId: "crew-b",
        relatedEmployeeId: null,
        resolutionStatus: "open",
      },
    ],
    dailyAssignments: [
      {
        assignmentId: "as-1",
        title: "Foundation pour",
        projectId: "project-1",
        projectName: "Tower Build",
        crewId: "crew-a",
        crewName: "Crew A",
        assignedEmployeeIds: ["emp-2"],
        assignedEmployeeNames: ["Jordan"],
        requiredHeadcount: 4,
        missingHeadcount: 3,
        status: "published",
        startTime: "07:00",
        endTime: "15:00",
      },
      {
        assignmentId: "as-2",
        title: "Pre-stage materials",
        projectId: "project-1",
        projectName: "Tower Build",
        crewId: "crew-b",
        crewName: "Crew B",
        assignedEmployeeIds: ["emp-1", "emp-2"],
        assignedEmployeeNames: ["Alex", "Jordan"],
        requiredHeadcount: 2,
        missingHeadcount: 0,
        status: "published",
        startTime: "16:00",
        endTime: "18:00",
      },
    ],
    findings: [
      {
        id: "finding-1",
        companyId: "co-1",
        domain: "workforce",
        type: "ACTIVE_EMPLOYEE_WITHOUT_ASSIGNMENT",
        category: "coverage",
        severity: "high",
        confidence: 0.9,
        status: "open",
        title: "Employee uncovered",
        observation: "No assignment",
        impact: "Coverage risk",
        recommendation: "Assign worker",
        affectedEntities: [],
        evidence: {},
        detectedAt: "2026-08-07T12:00:00.000Z",
        resolvedAt: null,
        ruleId: "rule-1",
        ruleVersion: "1",
      },
      {
        id: "finding-2",
        companyId: "co-1",
        domain: "workforce",
        type: "CREW_WITHOUT_ACTIVE_SUPERVISOR",
        category: "relationship",
        severity: "medium",
        confidence: 0.7,
        status: "open",
        title: "Supervisor gap",
        observation: "Supervisor missing",
        impact: "Coordination risk",
        recommendation: "Assign supervisor",
        affectedEntities: [],
        evidence: {},
        detectedAt: "2026-08-07T12:00:00.000Z",
        resolvedAt: null,
        ruleId: "rule-2",
        ruleVersion: "1",
      },
    ],
    evaluatedAtIso: "2026-08-07T12:00:00.000Z",
  };
}

function makeDb() {
  return {
    workforce_orion_recommendations: [] as Row[],
    workforce_orion_recommendation_history: [] as Row[],
    workforce_orion_recommendation_outcomes: [] as Row[],
    workforce_orion_score_snapshots: [] as Row[],
    workforce_orion_timeline_events: [] as Row[],
  };
}

async function main() {
  await test("1. Workforce score formulas remain deterministic", () => {
    const result = evaluateOrionWorkforceIntelligence(makeEvaluatorFixture() as never);
    const byId = new Map(result.intelligence.scores.map((score) => [score.id, score]));

    assert(byId.get("workforce_health")?.value === 66, "workforce health formula matches expected value");
    assert(byId.get("crew_efficiency")?.value === 44, "crew efficiency formula matches expected value");
    assert(byId.get("labor_utilization")?.value === 70, "labor utilization formula matches expected value");
    assert(byId.get("attendance_reliability")?.value === 33, "attendance reliability formula matches expected value");
    assert(byId.get("staffing_risk")?.value === 54, "staffing risk formula matches expected value");
    assert(byId.get("schedule_confidence")?.value === 82, "schedule confidence formula matches expected value");
    assert(byId.get("equipment_readiness")?.value === 50, "equipment readiness formula matches expected value");
    assert(byId.get("safety_readiness")?.value === 87, "safety readiness formula matches expected value");
  });

  await test("2. Recommendation trigger rules, priority, and confidence are deterministic", () => {
    const result = evaluateOrionWorkforceIntelligence(makeEvaluatorFixture() as never);
    const byType = new Map(result.intelligence.recommendations.map((recommendation) => [recommendation.type, recommendation]));

    assert(byType.has("add_additional_workers"), "staffing gap triggers add_additional_workers recommendation");
    assert(byType.has("move_employee_to_another_crew"), "available worker triggers move_employee_to_another_crew recommendation");
    assert(byType.has("reassign_supervisor"), "supervisor gap triggers reassign_supervisor recommendation");
    assert(byType.has("shift_equipment"), "missing equipment triggers shift_equipment recommendation");

    const addWorkers = byType.get("add_additional_workers");
    assert(addWorkers?.priority === "critical", "priority is critical for large staffing gap");
    assert(addWorkers?.confidence === 0.86, "recommendation confidence stays deterministic");

    const scoreConfidence = result.intelligence.scores[0]?.confidence;
    assert(scoreConfidence === 0.8, "score confidence remains deterministic from findings average");
  });

  await test("3. Stable recommendation fingerprinting remains deterministic", () => {
    const base: OrionRecommendation = {
      id: "r-1",
      type: "add_additional_workers",
      title: "Add Additional Workers",
      reason: "Project A has 4 missing workers.",
      priority: "critical",
      expectedImpact: "Improve schedule confidence",
      confidence: 0.86,
      affectedProjectId: "project-1",
    };

    const sameFingerprint = createRecommendationFingerprint(base);
    const sameFingerprintAgain = createRecommendationFingerprint({ ...base });
    const differentFingerprint = createRecommendationFingerprint({ ...base, reason: "Project A has 2 missing workers." });

    assert(sameFingerprint === sameFingerprintAgain, "fingerprint is stable for identical recommendation payload");
    assert(sameFingerprint !== differentFingerprint, "fingerprint changes when recommendation meaning changes");
  });

  await test("4. Duplicate recommendation prevention and timeline dedupe", async () => {
    const db = makeDb();
    const supabase = new MockSupabase(db);
    const service = createWorkforceIntelligencePersistenceService(supabase as never);
    const evaluation = evaluateOrionWorkforceIntelligence(makeEvaluatorFixture() as never);

    await service.reconcileEvaluation({
      companyId: "co-1",
      actorProfileId: "user-1",
      evaluatedAtIso: "2026-08-07T12:00:00.000Z",
      recommendations: evaluation.intelligence.recommendations,
      scores: evaluation.intelligence.scores,
      timeline: evaluation.intelligence.timeline,
    });

    await service.reconcileEvaluation({
      companyId: "co-1",
      actorProfileId: "user-1",
      evaluatedAtIso: "2026-08-07T12:05:00.000Z",
      recommendations: evaluation.intelligence.recommendations,
      scores: evaluation.intelligence.scores,
      timeline: evaluation.intelligence.timeline,
    });

    const recommendations = supabase.snapshot("workforce_orion_recommendations");
    const timelineRows = supabase.snapshot("workforce_orion_timeline_events");

    assert(recommendations.length === evaluation.intelligence.recommendations.length, "reconcile does not create duplicate active recommendations");
    assert(timelineRows.length === evaluation.intelligence.timeline.length, "timeline dedupe prevents duplicate event rows within dedupe window");
  });

  await test("5. Recommendation lifecycle transitions are enforced", async () => {
    const db = makeDb();
    const supabase = new MockSupabase(db);
    const service = createWorkforceIntelligencePersistenceService(supabase as never);
    const evaluation = evaluateOrionWorkforceIntelligence(makeEvaluatorFixture() as never);

    const reconciled = await service.reconcileEvaluation({
      companyId: "co-1",
      actorProfileId: "user-1",
      evaluatedAtIso: "2026-08-07T12:00:00.000Z",
      recommendations: evaluation.intelligence.recommendations,
      scores: evaluation.intelligence.scores,
      timeline: evaluation.intelligence.timeline,
    });

    const recommendationId = reconciled.recommendations[0]?.id;
    if (!recommendationId) {
      throw new Error("expected recommendation id");
    }

    assert(isValidLifecycleTransition("open", "acknowledged"), "open -> acknowledged transition allowed");
    assert(!isValidLifecycleTransition("completed", "accepted"), "completed -> accepted transition blocked");

    await service.acknowledgeRecommendation({ companyId: "co-1", recommendationId, actorProfileId: "user-1" });
    await service.acceptRecommendation({ companyId: "co-1", recommendationId, actorProfileId: "user-1" });
    await service.completeRecommendation({ companyId: "co-1", recommendationId, actorProfileId: "user-1", note: "Executed by supervisor" });

    const updated = supabase.snapshot("workforce_orion_recommendations").find((row) => row.id === recommendationId) || null;
    assert(updated?.status === "completed", "recommendation status transitions to completed");
    assert(typeof updated?.completed_at === "string", "completed timestamp is persisted");

    let blocked = false;
    try {
      await service.dismissRecommendation({ companyId: "co-1", recommendationId, actorProfileId: "user-1" });
    } catch {
      blocked = true;
    }
    assert(blocked, "invalid completed -> dismissed transition is rejected");

    const history = supabase.snapshot("workforce_orion_recommendation_history").filter((row) => row.recommendation_id === recommendationId);
    assert(history.length >= 4, "lifecycle actions persist recommendation history entries");
  });

  await test("6. Outcome tracking writes durable outcome rows", async () => {
    const db = makeDb();
    const supabase = new MockSupabase(db);
    const service = createWorkforceIntelligencePersistenceService(supabase as never);
    const evaluation = evaluateOrionWorkforceIntelligence(makeEvaluatorFixture() as never);

    const reconciled = await service.reconcileEvaluation({
      companyId: "co-1",
      actorProfileId: "user-1",
      evaluatedAtIso: "2026-08-07T12:00:00.000Z",
      recommendations: evaluation.intelligence.recommendations,
      scores: evaluation.intelligence.scores,
      timeline: evaluation.intelligence.timeline,
    });

    const recommendationId = reconciled.recommendations[0]?.id;
    if (!recommendationId) {
      throw new Error("expected recommendation id");
    }

    await service.recordRecommendationOutcome({
      companyId: "co-1",
      recommendationId,
      actorProfileId: "user-1",
      outcomeStatus: "successful",
      note: "Recovered two hours of schedule risk",
      metrics: { delayHoursRecovered: 2 },
    });

    const recommendation = supabase.snapshot("workforce_orion_recommendations").find((row) => row.id === recommendationId) || null;
    const outcomes = supabase.snapshot("workforce_orion_recommendation_outcomes").filter((row) => row.recommendation_id === recommendationId);

    assert(recommendation?.outcome_status === "successful", "recommendation outcome status is persisted");
    assert(outcomes.length === 1, "outcome history row is persisted");
  });

  await test("7. Timeline event normalization/fingerprinting is stable", () => {
    const event: WorkforceTimelineEvent = {
      id: "t-1",
      type: "late",
      timestamp: "2026-08-07T12:00:00.000Z",
      title: "Alex marked late",
      detail: "Attendance reliability risk",
      severity: "high",
      employeeId: "emp-1",
      source: "orion_workforce_evaluator",
    };

    const fingerprintA = createTimelineFingerprint(event);
    const fingerprintB = createTimelineFingerprint({ ...event, id: "t-2", timestamp: "2026-08-07T12:05:00.000Z" });

    assert(fingerprintA === fingerprintB, "timeline fingerprint is stable across repeated normalization runs");
  });

  await test("8. Historical score snapshot mapping preserves all tracked scores", () => {
    const result = evaluateOrionWorkforceIntelligence(makeEvaluatorFixture() as never);
    const snapshots = mapScoreSnapshots("co-1", "2026-08-07T12:00:00.000Z", result.intelligence.scores as OrionWorkforceScore[]);

    assert(snapshots.length === 8, "all 8 workforce scores map into snapshot rows");
    assert(snapshots.every((row) => typeof row.explanation === "string" && row.explanation.length > 0), "snapshot explanation mapping is complete");
    assert(snapshots.every((row) => typeof row.recommended_action === "string" && row.recommended_action.length > 0), "snapshot action mapping is complete");
  });

  console.log(`\nWorkforce intelligence phase 5 tests: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
