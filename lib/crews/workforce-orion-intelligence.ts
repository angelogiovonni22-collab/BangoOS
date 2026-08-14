import type { WorkforceFinding } from "@/lib/workforce";
import type {
  AssignmentConflictRow,
  CommandCenterWidgets,
  CrewStatusRow,
  DailyAssignmentRow,
  EmployeeStatusRow,
  OrionRecommendation,
  OrionWorkforceIntelligence,
  OrionWorkforceScore,
  OverdueItems,
  ProjectOperationsRow,
  ProjectStaffingRow,
  WorkforceTimelineEvent,
} from "./workforce-operations-types";

type OrionEvaluationInput = {
  summary: {
    activeEmployees: number;
    activeCrews: number;
    employeesClockedIn: number;
    employeesOffToday: number;
    employeesLate: number;
    employeesAbsent: number;
    openAssignments: number;
    averageCrewUtilization: number;
  };
  crewStatus: CrewStatusRow[];
  employeeStatus: EmployeeStatusRow[];
  projectStaffing: ProjectStaffingRow[];
  projectOperations: ProjectOperationsRow[];
  overdueItems: OverdueItems;
  assignmentConflicts: AssignmentConflictRow[];
  dailyAssignments: DailyAssignmentRow[];
  findings: WorkforceFinding[];
  evaluatedAtIso: string;
};

type OrionEvaluationResult = {
  intelligence: OrionWorkforceIntelligence;
  commandCenterExtensions: Pick<
    CommandCenterWidgets,
    | "todaysRisks"
    | "todaysOpportunities"
    | "criticalWorkforceAlerts"
    | "recommendedSupervisorActions"
    | "upcomingStaffingIssues"
    | "forecastedLaborShortages"
  >;
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toTrend(value: number, goodThreshold: number, watchThreshold: number): "up" | "down" | "flat" {
  if (value >= goodThreshold) {
    return "up";
  }

  if (value <= watchThreshold) {
    return "down";
  }

  return "flat";
}

function confidenceFromFindings(findings: WorkforceFinding[], fallback: number) {
  if (findings.length === 0) {
    return fallback;
  }

  const average = findings.reduce((sum, finding) => sum + finding.confidence, 0) / findings.length;
  return Math.max(0.45, Math.min(0.96, Number(average.toFixed(2))));
}

function buildScores(input: OrionEvaluationInput): OrionWorkforceScore[] {
  const totalEmployees = Math.max(1, input.employeeStatus.length);
  const totalCrews = Math.max(1, input.crewStatus.length);
  const missingWorkers = input.projectStaffing.reduce((sum, project) => sum + project.openPositions, 0);
  const conflictCount = input.assignmentConflicts.filter((conflict) => conflict.resolutionStatus === "open").length;
  const overtimeCount = input.employeeStatus.filter((employee) => employee.overtime).length;
  const safetyFlagCount = input.overdueItems.safetyFlags.length;
  const missingEquipmentCount = input.overdueItems.missingEquipment.length;

  const workforceHealth = clampScore(
    100
    - input.summary.employeesLate * 4
    - input.summary.employeesAbsent * 8
    - conflictCount * 3
    - missingWorkers * 4,
  );

  const crewsWorking = input.crewStatus.filter((crew) => crew.shiftStatus === "working").length;
  const crewEfficiency = clampScore((crewsWorking / totalCrews) * 100 - input.overdueItems.missingEquipment.length * 6);

  const laborUtilization = clampScore(input.summary.averageCrewUtilization);

  const attendanceReliability = clampScore(
    ((totalEmployees - input.summary.employeesLate - input.summary.employeesAbsent) / totalEmployees) * 100,
  );

  const staffingRisk = clampScore(100 - (missingWorkers * 8 + conflictCount * 4 + input.summary.openAssignments * 3));

  const scheduleConfidence = clampScore(100 - conflictCount * 5 - input.assignmentConflicts.filter((conflict) => conflict.severity === "critical").length * 8);

  const equipmentReadiness = clampScore(((totalCrews - missingEquipmentCount) / totalCrews) * 100);

  const safetyReadiness = clampScore(100 - safetyFlagCount * 10 - overtimeCount * 3);

  const confidence = confidenceFromFindings(input.findings, 0.74);

  return [
    {
      id: "workforce_health",
      label: "Workforce Health Score",
      value: workforceHealth,
      trend: toTrend(workforceHealth, 80, 60),
      confidence,
      explanation: "Combines attendance, open conflicts, and staffing gaps across active operations.",
      recommendedAction: "Prioritize late/absent workers and fill open staffing positions before midday.",
    },
    {
      id: "crew_efficiency",
      label: "Crew Efficiency Score",
      value: crewEfficiency,
      trend: toTrend(crewEfficiency, 78, 58),
      confidence,
      explanation: "Measures active working crews adjusted by missing equipment and off-duty drift.",
      recommendedAction: "Rebalance off-duty crews and resolve equipment coverage for active jobs.",
    },
    {
      id: "labor_utilization",
      label: "Labor Utilization Score",
      value: laborUtilization,
      trend: toTrend(laborUtilization, 75, 55),
      confidence,
      explanation: "Derived from aggregate crew utilization in the current schedule payload.",
      recommendedAction: "Move idle workers into understaffed assignments to raise effective utilization.",
    },
    {
      id: "attendance_reliability",
      label: "Attendance Reliability",
      value: attendanceReliability,
      trend: toTrend(attendanceReliability, 90, 70),
      confidence,
      explanation: "Tracks reliability by comparing active roster against late and absent worker counts.",
      recommendedAction: "Trigger attendance follow-up for late and absent employees before shift midpoint.",
    },
    {
      id: "staffing_risk",
      label: "Staffing Risk",
      value: staffingRisk,
      trend: toTrend(staffingRisk, 75, 52),
      confidence,
      explanation: "Penalizes unresolved staffing shortages, open assignments, and conflict volume.",
      recommendedAction: "Deploy available workers to high-risk projects and clear staffing conflicts.",
    },
    {
      id: "schedule_confidence",
      label: "Schedule Confidence",
      value: scheduleConfidence,
      trend: toTrend(scheduleConfidence, 82, 60),
      confidence,
      explanation: "Represents confidence in schedule integrity based on open and critical conflicts.",
      recommendedAction: "Resolve critical schedule conflicts and acknowledge medium severity overlaps.",
    },
    {
      id: "equipment_readiness",
      label: "Equipment Readiness",
      value: equipmentReadiness,
      trend: toTrend(equipmentReadiness, 88, 65),
      confidence,
      explanation: "Measures equipment coverage for crews currently in execution states.",
      recommendedAction: "Shift available equipment to working/traveling crews that have zero coverage.",
    },
    {
      id: "safety_readiness",
      label: "Safety Readiness",
      value: safetyReadiness,
      trend: toTrend(safetyReadiness, 85, 62),
      confidence,
      explanation: "Scores open safety flags and overtime pressure as leading safety indicators.",
      recommendedAction: "Address flagged safety notes and reduce overtime concentration by reassignment.",
    },
  ];
}

function buildRecommendations(input: OrionEvaluationInput): OrionRecommendation[] {
  const recommendations: OrionRecommendation[] = [];

  const firstStaffingGap = input.projectStaffing.find((project) => project.openPositions > 0);
  if (firstStaffingGap) {
    recommendations.push({
      id: `add-workers-${firstStaffingGap.projectId}`,
      type: "add_additional_workers",
      title: "Add Additional Workers",
      reason: `${firstStaffingGap.projectName} has ${firstStaffingGap.openPositions} missing workers.`,
      priority: firstStaffingGap.openPositions > 3 ? "critical" : "high",
      expectedImpact: "Reduce delay risk and improve schedule confidence on active project work.",
      confidence: 0.86,
      affectedProjectId: firstStaffingGap.projectId,
    });
  }

  const movableEmployee = input.employeeStatus.find((employee) => employee.currentStatus === "available");
  const targetCrew = input.crewStatus.find((crew) => crew.shiftStatus === "working" && crew.employeeCount < 3);
  if (movableEmployee && targetCrew) {
    recommendations.push({
      id: `move-employee-${movableEmployee.employeeId}`,
      type: "move_employee_to_another_crew",
      title: "Move Employee To Another Crew",
      reason: `${movableEmployee.employeeName} is available while ${targetCrew.crewName} is under capacity.`,
      priority: "high",
      expectedImpact: "Increases crew throughput and improves labor utilization immediately.",
      confidence: 0.78,
      affectedCrewId: targetCrew.crewId,
      affectedEmployeeId: movableEmployee.employeeId,
    });
  }

  const supervisorGapCrew = input.crewStatus.find((crew) => !crew.supervisorName && crew.shiftStatus !== "off_duty");
  if (supervisorGapCrew) {
    recommendations.push({
      id: `reassign-supervisor-${supervisorGapCrew.crewId}`,
      type: "reassign_supervisor",
      title: "Reassign Supervisor",
      reason: `${supervisorGapCrew.crewName} is active without a supervisor assignment.`,
      priority: "high",
      expectedImpact: "Improves supervision coverage and reduces operational coordination delays.",
      confidence: 0.8,
      affectedCrewId: supervisorGapCrew.crewId,
    });
  }

  const overstaffedProject = input.projectStaffing.find((project) => project.assignedWorkers - project.requiredWorkers >= 2);
  if (overstaffedProject) {
    recommendations.push({
      id: `remove-excess-${overstaffedProject.projectId}`,
      type: "remove_excess_labor",
      title: "Remove Excess Labor",
      reason: `${overstaffedProject.projectName} appears overstaffed against required headcount.`,
      priority: "medium",
      expectedImpact: "Frees workers for understaffed projects without reducing current output.",
      confidence: 0.72,
      affectedProjectId: overstaffedProject.projectId,
    });
  }

  const missingEquipment = input.overdueItems.missingEquipment[0];
  if (missingEquipment) {
    recommendations.push({
      id: `shift-equipment-${missingEquipment.crewId}`,
      type: "shift_equipment",
      title: "Shift Equipment",
      reason: `${missingEquipment.crewName} is active with no assigned equipment coverage.`,
      priority: "high",
      expectedImpact: "Reduces idle time and execution risk for in-progress assignments.",
      confidence: 0.81,
      affectedCrewId: missingEquipment.crewId,
    });
  }

  const criticalConflict = input.assignmentConflicts.find((conflict) => conflict.severity === "critical");
  if (criticalConflict) {
    recommendations.push({
      id: `delay-assignment-${criticalConflict.id}`,
      type: "delay_assignment",
      title: "Delay Assignment",
      reason: `Critical conflict detected: ${criticalConflict.title}.`,
      priority: "critical",
      expectedImpact: "Prevents conflict amplification and avoids downstream assignment failures.",
      confidence: 0.83,
      affectedCrewId: criticalConflict.relatedCrewId,
      affectedEmployeeId: criticalConflict.relatedEmployeeId,
      affectedProjectId: criticalConflict.relatedProjectId,
    });
  }

  const earlyStartCandidate = input.dailyAssignments.find((assignment) => assignment.missingHeadcount === 0 && assignment.status === "published");
  if (earlyStartCandidate) {
    recommendations.push({
      id: `start-early-${earlyStartCandidate.assignmentId}`,
      type: "start_assignment_early",
      title: "Start Assignment Early",
      reason: `${earlyStartCandidate.title} is fully staffed and can begin ahead of schedule.`,
      priority: "medium",
      expectedImpact: "Creates schedule buffer and improves completion confidence.",
      confidence: 0.67,
      affectedCrewId: earlyStartCandidate.crewId,
      affectedProjectId: earlyStartCandidate.projectId,
    });
  }

  const unresolvedConflict = input.assignmentConflicts.find((conflict) => conflict.resolutionStatus === "open");
  if (unresolvedConflict) {
    recommendations.push({
      id: `resolve-conflict-${unresolvedConflict.id}`,
      type: "resolve_staffing_conflicts",
      title: "Resolve Staffing Conflicts",
      reason: `${unresolvedConflict.title} remains unresolved in the assignment queue.`,
      priority: unresolvedConflict.severity === "high" || unresolvedConflict.severity === "critical" ? "high" : "medium",
      expectedImpact: "Improves schedule confidence and reduces resource contention.",
      confidence: 0.79,
      affectedCrewId: unresolvedConflict.relatedCrewId,
      affectedEmployeeId: unresolvedConflict.relatedEmployeeId,
      affectedProjectId: unresolvedConflict.relatedProjectId,
    });
  }

  const overtimeEmployee = input.employeeStatus.find((employee) => employee.overtime);
  if (overtimeEmployee) {
    recommendations.push({
      id: `reduce-overtime-${overtimeEmployee.employeeId}`,
      type: "reduce_overtime",
      title: "Reduce Overtime",
      reason: `${overtimeEmployee.employeeName} is currently in overtime risk range.`,
      priority: "medium",
      expectedImpact: "Lowers fatigue risk and preserves labor cost controls.",
      confidence: 0.76,
      affectedEmployeeId: overtimeEmployee.employeeId,
    });
  }

  return recommendations.slice(0, 9);
}

function buildTimeline(input: OrionEvaluationInput): WorkforceTimelineEvent[] {
  const events: WorkforceTimelineEvent[] = [];
  const timestamp = input.evaluatedAtIso;

  for (const crew of input.crewStatus) {
    if (crew.shiftStatus === "off_duty") {
      continue;
    }

    events.push({
      id: `shift-${crew.crewId}-${crew.shiftStatus}`,
      type: crew.shiftStatus === "finished" ? "completed" : crew.shiftStatus,
      timestamp,
      title: `${crew.crewName} ${crew.shiftStatus.replace("_", " ")}`,
      detail: crew.currentProjectName || "Crew status event",
      severity: crew.shiftStatus === "break" || crew.shiftStatus === "lunch" ? "low" : "medium",
      crewId: crew.crewId,
      source: "orion_workforce_evaluator",
    });

    if (crew.equipmentAssignedCount > 0) {
      events.push({
        id: `equipment-${crew.crewId}`,
        type: "equipment_assigned",
        timestamp,
        title: `${crew.crewName} equipment assigned`,
        detail: `${crew.equipmentAssignedCount} equipment resources assigned`,
        severity: "low",
        crewId: crew.crewId,
        source: "orion_workforce_evaluator",
      });
    }

    if (crew.supervisorName) {
      events.push({
        id: `supervisor-${crew.crewId}`,
        type: "supervisor_changed",
        timestamp,
        title: `${crew.crewName} supervisor set`,
        detail: crew.supervisorName,
        severity: "low",
        crewId: crew.crewId,
        source: "orion_workforce_evaluator",
      });
    }
  }

  for (const employee of input.overdueItems.lateEmployees) {
    events.push({
      id: `late-${employee.employeeId}`,
      type: "late",
      timestamp,
      title: `${employee.employeeName} marked late`,
      detail: "Attendance reliability risk",
      severity: "high",
      employeeId: employee.employeeId,
      source: "orion_workforce_evaluator",
    });
  }

  for (const employee of input.employeeStatus.filter((item) => item.currentStatus === "absent")) {
    events.push({
      id: `absent-${employee.employeeId}`,
      type: "absent",
      timestamp,
      title: `${employee.employeeName} marked absent`,
      detail: "Coverage impact expected",
      severity: "critical",
      employeeId: employee.employeeId,
      source: "orion_workforce_evaluator",
    });
  }

  for (const conflict of input.assignmentConflicts.filter((item) => item.type.includes("crew") || item.type.includes("understaffed")).slice(0, 6)) {
    events.push({
      id: `reassigned-${conflict.id}`,
      type: "crew_reassigned",
      timestamp,
      title: conflict.title,
      detail: "Crew reassignment expected to resolve conflict",
      severity: conflict.severity === "critical" || conflict.severity === "high" ? "high" : "medium",
      crewId: conflict.relatedCrewId,
      employeeId: conflict.relatedEmployeeId,
      projectId: conflict.relatedProjectId,
      source: "orion_workforce_evaluator",
    });
  }

  return events.sort((left, right) => left.title.localeCompare(right.title)).slice(0, 60);
}

function buildCommandCenterExtensions(
  input: OrionEvaluationInput,
  recommendations: OrionRecommendation[],
): OrionEvaluationResult["commandCenterExtensions"] {
  const todaysRisks = input.assignmentConflicts
    .filter((conflict) => conflict.resolutionStatus === "open")
    .slice(0, 8)
    .map((conflict) => ({ id: conflict.id, title: conflict.title, severity: conflict.severity === "informational" ? "low" : conflict.severity }));

  const todaysOpportunities = input.dailyAssignments
    .filter((assignment) => assignment.status === "published" && assignment.missingHeadcount === 0)
    .slice(0, 8)
    .map((assignment) => ({
      id: assignment.assignmentId,
      title: `${assignment.title} can be accelerated`,
      impact: "Potential earlier completion",
    }));

  const criticalWorkforceAlerts = input.findings
    .filter((finding) => finding.severity === "critical" || finding.severity === "high")
    .slice(0, 8)
    .map((finding) => ({
      id: finding.id,
      title: finding.title,
      explanation: finding.observation,
    }));

  const recommendedSupervisorActions = recommendations.slice(0, 8).map((recommendation) => ({
    id: recommendation.id,
    action: recommendation.reason,
    priority: recommendation.priority,
  }));

  const upcomingStaffingIssues = input.dailyAssignments
    .filter((assignment) => assignment.missingHeadcount > 0)
    .slice(0, 8)
    .map((assignment) => ({
      projectName: assignment.projectName,
      startsAt: assignment.startTime,
      missingWorkers: assignment.missingHeadcount,
    }));

  const forecastedLaborShortages = input.projectOperations
    .filter((project) => project.missingWorkers > 0)
    .slice(0, 8)
    .map((project) => ({
      projectName: project.projectName,
      shortageCount: project.missingWorkers,
      confidence: 0.74,
    }));

  return {
    todaysRisks,
    todaysOpportunities,
    criticalWorkforceAlerts,
    recommendedSupervisorActions,
    upcomingStaffingIssues,
    forecastedLaborShortages,
  };
}

export function evaluateOrionWorkforceIntelligence(input: OrionEvaluationInput): OrionEvaluationResult {
  const scores = buildScores(input);
  const recommendations = buildRecommendations(input);
  const timeline = buildTimeline(input);

  return {
    intelligence: {
      scores,
      recommendations,
      timeline,
    },
    commandCenterExtensions: buildCommandCenterExtensions(input, recommendations),
  };
}
