import {
  isEquipmentConflict,
  isEquipmentInUse,
  isEquipmentOutOfService,
} from "@/lib/equipment";
import {
  hasAssignmentConflict,
  isActiveAssignment,
  isActiveCrew,
  isActiveEmployee,
  isAvailableEmployee,
  isCurrentMembership,
} from "./workforce-semantics";
import type {
  CrewDirectoryFilters,
  CrewDirectoryResult,
  CrewDirectoryRow,
  CrewMembershipView,
  CrewProfileData,
  EmployeeDirectoryFilters,
  EmployeeDirectoryResult,
  EmployeeDirectoryRow,
  EmployeeProfileData,
  SelectOption,
  WorkforceAssignmentRow,
  WorkforceAssignmentView,
  WorkforceCrewRow,
  WorkforceEmployeeRow,
  WorkforceEquipmentContext,
  WorkforceEquipmentRow,
  WorkforceMembershipRow,
  WorkforcePhaseRow,
  WorkforceProfileRow,
  WorkforceProjectRow,
  WorkforceTaskRow,
} from "./workforce-types";

const ACTIVE_ASSIGNMENT_STATUSES = new Set(["planned", "confirmed", "in_progress"]);

function displayName(profile: WorkforceProfileRow | null | undefined) {
  if (!profile) {
    return null;
  }

  const full = [profile.first_name?.trim() || "", profile.last_name?.trim() || ""]
    .filter(Boolean)
    .join(" ")
    .trim();

  return full || null;
}

function toMap<T extends { id: string }>(items: T[]) {
  return new Map(items.map((item) => [item.id, item]));
}

function toDate(value: string) {
  return new Date(value).getTime();
}

function assignmentBucket(assignment: WorkforceAssignmentRow, now: Date) {
  const nowValue = now.getTime();
  const start = toDate(assignment.starts_at);
  const end = toDate(assignment.ends_at);

  if (assignment.status === "completed" || assignment.status === "cancelled" || end < nowValue) {
    return "completed" as const;
  }

  if (start > nowValue) {
    return "upcoming" as const;
  }

  if (ACTIVE_ASSIGNMENT_STATUSES.has(assignment.status)) {
    return "current" as const;
  }

  return "upcoming" as const;
}

function assignmentPriority(assignment: WorkforceAssignmentView) {
  if (assignment.bucket === "current") {
    return 0;
  }

  if (assignment.bucket === "upcoming") {
    return 1;
  }

  return 2;
}

export function normalizeAssignmentViews(input: {
  assignments: WorkforceAssignmentRow[];
  crews: WorkforceCrewRow[];
  employees: WorkforceEmployeeRow[];
  projects: WorkforceProjectRow[];
  phases: WorkforcePhaseRow[];
  tasks: WorkforceTaskRow[];
  profiles: WorkforceProfileRow[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const crewById = toMap(input.crews);
  const employeeById = toMap(input.employees);
  const projectById = toMap(input.projects);
  const phaseById = toMap(input.phases);
  const taskById = toMap(input.tasks);
  const profileById = toMap(input.profiles);

  const views = input.assignments.map((assignment) => {
    const crew = assignment.crew_id ? crewById.get(assignment.crew_id) || null : null;
    const employee = assignment.employee_id ? employeeById.get(assignment.employee_id) || null : null;
    const employeeName = employee && employee.profile_id ? displayName(profileById.get(employee.profile_id) || null) : null;
    const phase = assignment.phase_id ? phaseById.get(assignment.phase_id) || null : null;
    const task = assignment.task_id ? taskById.get(assignment.task_id) || null : null;
    const project = projectById.get(assignment.project_id) || null;
    const bucket = assignmentBucket(assignment, now);
    const current = bucket === "current";

    return {
      id: assignment.id,
      assignmentType: assignment.assignment_type,
      status: assignment.status,
      sourceType: assignment.source_type,
      title: assignment.title,
      startsAt: assignment.starts_at,
      endsAt: assignment.ends_at,
      plannedHours: assignment.planned_hours,
      notes: assignment.notes,
      projectId: assignment.project_id,
      projectName: project?.name || "Unknown project",
      phaseId: assignment.phase_id,
      phaseName: phase?.name || null,
      taskId: assignment.task_id,
      taskName: task?.title || null,
      crewId: assignment.crew_id,
      crewName: crew?.name || null,
      employeeId: assignment.employee_id,
      employeeName,
      bucket,
      isCurrent: current,
      isUpcoming: bucket === "upcoming",
      isCompleted: bucket === "completed",
      hasConflict: hasAssignmentConflict(assignment, input.assignments),
      displayTaskOrPhase: task?.title || phase?.name || null,
    } satisfies WorkforceAssignmentView;
  });

  return views.sort((left, right) => {
    const bucketSort = assignmentPriority(left) - assignmentPriority(right);
    if (bucketSort !== 0) {
      return bucketSort;
    }

    const startSort = toDate(left.startsAt) - toDate(right.startsAt);
    if (startSort !== 0) {
      return startSort;
    }

    return left.id.localeCompare(right.id);
  });
}

export function normalizeMembershipViews(input: {
  memberships: WorkforceMembershipRow[];
  crews: WorkforceCrewRow[];
  employees: WorkforceEmployeeRow[];
  profiles: WorkforceProfileRow[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const crewById = toMap(input.crews);
  const employeeById = toMap(input.employees);
  const profileById = toMap(input.profiles);

  return input.memberships
    .map((membership) => {
      const crew = crewById.get(membership.crew_id) || null;
      const employee = employeeById.get(membership.employee_id) || null;
      const employeeName = employee && employee.profile_id ? displayName(profileById.get(employee.profile_id) || null) : null;

      return {
        id: membership.id,
        crewId: membership.crew_id,
        crewName: crew?.name || "Unknown crew",
        employeeId: membership.employee_id,
        employeeName: employeeName || employee?.employee_number || "Unknown employee",
        role: membership.role,
        isPrimary: membership.is_primary,
        startsOn: membership.starts_on,
        endsOn: membership.ends_on,
        status: membership.status,
        isCurrent: isCurrentMembership(membership, now),
      } satisfies CrewMembershipView;
    })
    .sort((left, right) => {
      const currentSort = Number(right.isCurrent) - Number(left.isCurrent);
      if (currentSort !== 0) {
        return currentSort;
      }

      const dateSort = toDate(`${right.startsOn}T00:00:00.000Z`) - toDate(`${left.startsOn}T00:00:00.000Z`);
      if (dateSort !== 0) {
        return dateSort;
      }

      return left.id.localeCompare(right.id);
    });
}

function normalizeEquipment(items: WorkforceEquipmentRow[]) {
  return items.map((equipment) => {
    const semanticSnapshot = {
      status: equipment.status,
      maintenanceStatus: equipment.maintenance_status,
      assignedJobId: equipment.assigned_job_id,
      expectedReturnDate: equipment.expected_return_date,
    };

    return {
      id: equipment.id,
      equipmentNumber: equipment.equipment_number,
      name: equipment.name,
      status: equipment.status,
      maintenanceStatus: equipment.maintenance_status,
      assignedJobId: equipment.assigned_job_id,
      assignedCrewId: equipment.assigned_crew_id,
      assignedEmployeeId: equipment.assigned_employee_id,
      expectedReturnDate: equipment.expected_return_date,
      isInUse: isEquipmentInUse(semanticSnapshot),
      isConflict: isEquipmentConflict(semanticSnapshot),
      isOutOfService: isEquipmentOutOfService(semanticSnapshot),
      href: `/equipment/${equipment.id}`,
    };
  }) satisfies WorkforceEquipmentContext[];
}

function buildEmployeeName(employee: WorkforceEmployeeRow, profileById: Map<string, WorkforceProfileRow>) {
  const profile = employee.profile_id ? profileById.get(employee.profile_id) || null : null;
  return displayName(profile) || employee.employee_number;
}

function firstCurrentAssignment(assignments: WorkforceAssignmentView[]) {
  return assignments.find((assignment) => assignment.isCurrent)
    || assignments.find((assignment) => assignment.isUpcoming)
    || null;
}

export function normalizeEmployeeDirectory(input: {
  employees: WorkforceEmployeeRow[];
  crews: WorkforceCrewRow[];
  memberships: WorkforceMembershipRow[];
  assignments: WorkforceAssignmentRow[];
  projects: WorkforceProjectRow[];
  phases: WorkforcePhaseRow[];
  tasks: WorkforceTaskRow[];
  profiles: WorkforceProfileRow[];
  equipment: WorkforceEquipmentRow[];
  filters: EmployeeDirectoryFilters;
  partialNotices?: string[];
}) {
  const profileById = toMap(input.profiles);
  const crewById = toMap(input.crews);
  const employeeById = toMap(input.employees);
  const now = new Date();

  const membershipViews = normalizeMembershipViews({
    memberships: input.memberships,
    crews: input.crews,
    employees: input.employees,
    profiles: input.profiles,
    now,
  });

  const assignmentViews = normalizeAssignmentViews({
    assignments: input.assignments,
    crews: input.crews,
    employees: input.employees,
    projects: input.projects,
    phases: input.phases,
    tasks: input.tasks,
    profiles: input.profiles,
    now,
  });

  const equipment = normalizeEquipment(input.equipment);

  const membershipsByEmployee = new Map<string, CrewMembershipView[]>();
  for (const membership of membershipViews) {
    const bucket = membershipsByEmployee.get(membership.employeeId) ?? [];
    bucket.push(membership);
    membershipsByEmployee.set(membership.employeeId, bucket);
  }

  const assignmentsByEmployee = new Map<string, WorkforceAssignmentView[]>();
  for (const assignment of assignmentViews) {
    if (assignment.employeeId) {
      const bucket = assignmentsByEmployee.get(assignment.employeeId) ?? [];
      bucket.push(assignment);
      assignmentsByEmployee.set(assignment.employeeId, bucket);
    }

    if (assignment.crewId) {
      for (const member of membershipViews.filter((membership) => membership.crewId === assignment.crewId && membership.isCurrent)) {
        const bucket = assignmentsByEmployee.get(member.employeeId) ?? [];
        bucket.push(assignment);
        assignmentsByEmployee.set(member.employeeId, bucket);
      }
    }
  }

  const rows = input.employees.map((employee) => {
    const employeeName = buildEmployeeName(employee, profileById);
    const supervisor = employee.supervisor_profile_id ? displayName(profileById.get(employee.supervisor_profile_id) || null) : null;
    const membershipList = membershipsByEmployee.get(employee.id) ?? [];
    const currentPrimaryMembership = membershipList.find((membership) => membership.isCurrent && membership.isPrimary)
      || membershipList.find((membership) => membership.isCurrent)
      || null;
    const primaryCrew = employee.primary_crew_id ? crewById.get(employee.primary_crew_id) || null : null;
    const assignments = assignmentsByEmployee.get(employee.id) ?? [];
    const assignment = firstCurrentAssignment(assignments);

    return {
      id: employee.id,
      employeeNumber: employee.employee_number,
      fullName: employeeName,
      positionTitle: employee.position_title,
      trade: employee.trade,
      employmentStatus: employee.employment_status,
      availabilityStatus: employee.availability_status,
      supervisorName: supervisor,
      supervisorProfileId: employee.supervisor_profile_id,
      primaryCrewId: currentPrimaryMembership?.crewId || employee.primary_crew_id,
      primaryCrewName: currentPrimaryMembership?.crewName || primaryCrew?.name || null,
      currentAssignmentId: assignment?.id || null,
      currentAssignmentTitle: assignment?.title || null,
      currentProjectId: assignment?.projectId || null,
      currentProjectName: assignment?.projectName || null,
      currentPhaseOrTask: assignment?.displayTaskOrPhase || null,
      currentAssignmentStatus: assignment?.status || null,
      hireDate: employee.hire_date,
      updatedAt: employee.updated_at,
      notes: employee.notes,
      terminationDate: employee.termination_date,
      assignmentBucket: assignment?.bucket || null,
      equipmentCount: equipment.filter((item) => item.assignedEmployeeId === employee.id).length,
    } satisfies EmployeeDirectoryRow;
  });

  const filtered = rows.filter((row) => {
    const query = input.filters.query.trim().toLowerCase();

    if (query) {
      const haystack = [
        row.employeeNumber,
        row.fullName,
        row.positionTitle,
        row.trade || "",
        row.supervisorName || "",
        row.primaryCrewName || "",
        row.currentProjectName || "",
        row.currentAssignmentTitle || "",
      ].join(" ").toLowerCase();

      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (input.filters.employmentStatus !== "all" && row.employmentStatus !== input.filters.employmentStatus) {
      return false;
    }

    if (input.filters.availabilityStatus !== "all" && row.availabilityStatus !== input.filters.availabilityStatus) {
      return false;
    }

    if (input.filters.crewId !== "all" && row.primaryCrewId !== input.filters.crewId) {
      return false;
    }

    if (input.filters.supervisorId !== "all" && row.supervisorProfileId !== input.filters.supervisorId) {
      return false;
    }

    if (input.filters.projectId !== "all" && row.currentProjectId !== input.filters.projectId) {
      return false;
    }

    return true;
  });

  filtered.sort((left, right) => {
    switch (input.filters.sortBy) {
      case "name_desc":
        return right.fullName.localeCompare(left.fullName);
      case "employee_number_asc":
        return left.employeeNumber.localeCompare(right.employeeNumber);
      case "employee_number_desc":
        return right.employeeNumber.localeCompare(left.employeeNumber);
      case "updated_desc":
        return toDate(right.updatedAt) - toDate(left.updatedAt);
      case "updated_asc":
        return toDate(left.updatedAt) - toDate(right.updatedAt);
      case "name_asc":
      default:
        return left.fullName.localeCompare(right.fullName);
    }
  });

  const total = filtered.length;
  const pageSize = Math.max(1, input.filters.pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(input.filters.page, totalPages));
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const supervisorOptions = toOptions(
    input.employees
      .filter((employee) => employee.profile_id)
      .map((employee) => ({ id: employee.profile_id as string, label: buildEmployeeName(employee, profileById) })),
  );

  const crewOptions = toOptions(input.crews.map((crew) => ({ id: crew.id, label: crew.name })));
  const projectOptions = toOptions(input.projects.map((project) => ({ id: project.id, label: project.name })));

  const assignedToProjects = rows.filter((row) => row.currentProjectId).length;

  return {
    items,
    total,
    totalPages,
    page,
    pageSize,
    summary: {
      totalEmployees: rows.length,
      activeToday: rows.filter((row) => isActiveEmployee(employeeById.get(row.id) || { employment_status: "inactive" })).length,
      available: rows.filter((row) => {
        const employee = employeeById.get(row.id);
        return employee ? isAvailableEmployee(employee) : false;
      }).length,
      assignedToProjects,
      onLeave: rows.filter((row) => row.employmentStatus === "leave").length,
    },
    options: {
      crewOptions,
      supervisorOptions,
      projectOptions,
    },
    partialNotices: input.partialNotices ?? [],
    assignmentViews,
    membershipViews,
    equipment,
  } satisfies EmployeeDirectoryResult;
}

function toOptions(items: Array<{ id: string; label: string }>): SelectOption[] {
  const seen = new Set<string>();
  const options: SelectOption[] = [];

  for (const item of items) {
    const key = `${item.id}:${item.label}`;
    if (!item.id || !item.label || seen.has(key)) {
      continue;
    }

    seen.add(key);
    options.push({ id: item.id, label: item.label });
  }

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

function groupAssignments(assignments: WorkforceAssignmentView[]) {
  return {
    current: assignments.filter((assignment) => assignment.bucket === "current"),
    upcoming: assignments.filter((assignment) => assignment.bucket === "upcoming"),
    completed: assignments.filter((assignment) => assignment.bucket === "completed"),
  };
}

function groupMemberships(memberships: CrewMembershipView[]) {
  return {
    current: memberships.filter((membership) => membership.isCurrent),
    planned: memberships.filter((membership) => membership.status === "planned"),
    ended: memberships.filter((membership) => membership.status === "ended"),
  };
}

export function normalizeEmployeeProfile(input: {
  employeeId: string;
  directory: EmployeeDirectoryResult;
  memberships: CrewMembershipView[];
  assignments: WorkforceAssignmentView[];
  equipment: WorkforceEquipmentContext[];
}) {
  const overview = input.directory.items.find((item) => item.id === input.employeeId)
    || null;

  if (!overview) {
    return null;
  }

  const memberships = input.memberships.filter((membership) => membership.employeeId === input.employeeId);
  const groupedMemberships = groupMemberships(memberships);

  const assignments = input.assignments.filter((assignment) => assignment.employeeId === input.employeeId || assignment.crewId === overview.primaryCrewId);
  const groupedAssignments = groupAssignments(assignments);

  const directEquipment = input.equipment.filter((equipment) => equipment.assignedEmployeeId === input.employeeId);
  const crewEquipment = input.equipment.filter((equipment) => equipment.assignedCrewId && equipment.assignedCrewId === overview.primaryCrewId);
  const projectIds = new Set(assignments.map((assignment) => assignment.projectId));
  const projectEquipment = input.equipment.filter((equipment) => equipment.assignedJobId && projectIds.has(equipment.assignedJobId));

  return {
    overview,
    memberships: groupedMemberships,
    assignments: groupedAssignments,
    equipment: {
      direct: directEquipment,
      crew: crewEquipment,
      project: projectEquipment,
    },
    partialNotices: [
      "Payroll, certifications, safety, utilization, activity feed, and time entries are not available from Workforce Foundation Phase 1.",
    ],
  } satisfies EmployeeProfileData;
}

function deriveCrewAvailability(assignments: WorkforceAssignmentView[]) {
  const current = assignments.some((assignment) => assignment.isCurrent && isActiveAssignment({ status: assignment.status }));
  return current ? "assigned" : "available";
}

export function normalizeCrewDirectory(input: {
  crews: WorkforceCrewRow[];
  employees: WorkforceEmployeeRow[];
  memberships: WorkforceMembershipRow[];
  assignments: WorkforceAssignmentRow[];
  projects: WorkforceProjectRow[];
  phases: WorkforcePhaseRow[];
  tasks: WorkforceTaskRow[];
  profiles: WorkforceProfileRow[];
  equipment: WorkforceEquipmentRow[];
  filters: CrewDirectoryFilters;
  partialNotices?: string[];
}) {
  const now = new Date();
  const profileById = toMap(input.profiles);
  const membershipViews = normalizeMembershipViews({
    memberships: input.memberships,
    crews: input.crews,
    employees: input.employees,
    profiles: input.profiles,
    now,
  });

  const assignmentViews = normalizeAssignmentViews({
    assignments: input.assignments,
    crews: input.crews,
    employees: input.employees,
    projects: input.projects,
    phases: input.phases,
    tasks: input.tasks,
    profiles: input.profiles,
    now,
  });

  const equipment = normalizeEquipment(input.equipment);

  const rows = input.crews.map((crew) => {
    const leadName = crew.lead_profile_id ? displayName(profileById.get(crew.lead_profile_id) || null) : null;
    const supervisorName = crew.supervisor_profile_id ? displayName(profileById.get(crew.supervisor_profile_id) || null) : null;
    const members = membershipViews.filter((membership) => membership.crewId === crew.id);
    const activeMembers = members.filter((membership) => membership.isCurrent);
    const primaryMembers = activeMembers.filter((membership) => membership.isPrimary);
    const crewAssignments = assignmentViews.filter((assignment) => assignment.crewId === crew.id);
    const currentAssignment = crewAssignments.find((assignment) => assignment.isCurrent) || null;
    const nextAssignment = crewAssignments.find((assignment) => assignment.isUpcoming) || null;

    const crewEquipment = equipment.filter((item) => item.assignedCrewId === crew.id);
    const projectEquipment = currentAssignment
      ? equipment.filter((item) => item.assignedJobId === currentAssignment.projectId)
      : [];

    return {
      id: crew.id,
      crewCode: crew.crew_code,
      name: crew.name,
      status: crew.status,
      leadName,
      leadProfileId: crew.lead_profile_id,
      supervisorName,
      supervisorProfileId: crew.supervisor_profile_id,
      homeLocation: crew.home_location,
      description: crew.description,
      notes: crew.notes,
      activeMemberCount: activeMembers.length,
      primaryMemberCount: primaryMembers.length,
      currentAssignmentId: currentAssignment?.id || null,
      currentAssignmentTitle: currentAssignment?.title || null,
      currentProjectId: currentAssignment?.projectId || null,
      currentProjectName: currentAssignment?.projectName || null,
      currentPhaseOrTask: currentAssignment?.displayTaskOrPhase || null,
      currentAssignmentStatus: currentAssignment?.status || null,
      nextAssignmentTitle: nextAssignment?.title || null,
      nextProjectName: nextAssignment?.projectName || null,
      updatedAt: crew.updated_at,
      equipmentCount: crewEquipment.length,
      projectEquipmentCount: projectEquipment.length,
      hasEquipmentConflict: crewEquipment.concat(projectEquipment).some((item) => item.isConflict),
      availability: deriveCrewAvailability(crewAssignments),
      isActive: isActiveCrew(crew),
    } satisfies CrewDirectoryRow;
  });

  const filtered = rows.filter((row) => {
    const query = input.filters.query.trim().toLowerCase();
    if (query) {
      const haystack = [
        row.crewCode,
        row.name,
        row.leadName || "",
        row.supervisorName || "",
        row.currentProjectName || "",
        row.currentAssignmentTitle || "",
      ].join(" ").toLowerCase();

      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (input.filters.status !== "all" && row.status !== input.filters.status) {
      return false;
    }

    if (input.filters.leadId !== "all" && row.leadProfileId !== input.filters.leadId) {
      return false;
    }

    if (input.filters.supervisorId !== "all" && row.supervisorProfileId !== input.filters.supervisorId) {
      return false;
    }

    if (input.filters.projectId !== "all" && row.currentProjectId !== input.filters.projectId) {
      return false;
    }

    if (input.filters.assignmentStatus !== "all") {
      const status = row.currentAssignmentStatus || "none";
      if (status !== input.filters.assignmentStatus) {
        return false;
      }
    }

    return true;
  });

  filtered.sort((left, right) => {
    switch (input.filters.sortBy) {
      case "updated_desc":
        return toDate(right.updatedAt) - toDate(left.updatedAt);
      case "members_desc":
        return right.activeMemberCount - left.activeMemberCount || left.name.localeCompare(right.name);
      case "name_desc":
        return right.name.localeCompare(left.name);
      case "name_asc":
      default:
        return left.name.localeCompare(right.name);
    }
  });

  const total = filtered.length;
  const pageSize = Math.max(1, input.filters.pageSize);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(input.filters.page, totalPages));
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  const supervisorOptions = toOptions(
    rows
      .filter((row) => row.supervisorProfileId && row.supervisorName)
      .map((row) => ({ id: row.supervisorProfileId as string, label: row.supervisorName as string })),
  );

  const leadOptions = toOptions(
    rows
      .filter((row) => row.leadProfileId && row.leadName)
      .map((row) => ({ id: row.leadProfileId as string, label: row.leadName as string })),
  );

  const projectOptions = toOptions(input.projects.map((project) => ({ id: project.id, label: project.name })));

  return {
    items,
    total,
    totalPages,
    page,
    pageSize,
    summary: {
      totalCrews: rows.length,
      activeCrews: rows.filter((row) => row.isActive).length,
      availableCrews: rows.filter((row) => row.availability === "available").length,
      assignedCrews: rows.filter((row) => row.availability === "assigned").length,
    },
    options: {
      supervisorOptions,
      leadOptions,
      projectOptions,
    },
    partialNotices: input.partialNotices ?? [],
    assignmentViews,
    membershipViews,
    equipment,
  } satisfies CrewDirectoryResult;
}

export function normalizeCrewProfile(input: {
  crewId: string;
  directory: CrewDirectoryResult;
  memberships: CrewMembershipView[];
  assignments: WorkforceAssignmentView[];
  equipment: WorkforceEquipmentContext[];
}) {
  const overview = input.directory.items.find((item) => item.id === input.crewId)
    || null;

  if (!overview) {
    return null;
  }

  const memberships = input.memberships.filter((membership) => membership.crewId === input.crewId);
  const groupedMemberships = groupMemberships(memberships);

  const assignments = input.assignments.filter((assignment) => assignment.crewId === input.crewId);
  const groupedAssignments = groupAssignments(assignments);

  const projectIds = new Set(assignments.map((assignment) => assignment.projectId));
  const crewEquipment = input.equipment.filter((equipment) => equipment.assignedCrewId === input.crewId);
  const projectEquipment = input.equipment.filter((equipment) => equipment.assignedJobId && projectIds.has(equipment.assignedJobId));

  return {
    overview,
    memberships: groupedMemberships,
    assignments: groupedAssignments,
    equipment: {
      crew: crewEquipment,
      project: projectEquipment,
    },
    partialNotices: [
      "Time, payroll, certifications, safety, utilization, activity feed, and Orion workforce brief are not available from Workforce Foundation Phase 1.",
    ],
  } satisfies CrewProfileData;
}
