import { scheduleClock } from "../scheduling/time-zone";
import type { UpsertCrewInput } from "./types";
import type { createWorkforceService } from "../workforce";

export async function syncCrewMemberships(params: {
  timeZone: string;
  now?: Date;
  companyId: string;
  actorProfileId: string;
  crewId: string;
  input: UpsertCrewInput;
  workforce: ReturnType<typeof createWorkforceService>;
}) {
  const existingActive = await params.workforce.listCrewMemberships(params.companyId, {
    crewId: params.crewId,
    status: "active",
  });

  const byEmployeeId = new Map(existingActive.map((membership) => [membership.employee_id, membership]));
  const seenEmployees = new Set<string>();
  const today = scheduleClock((params.now ?? new Date()).toISOString(), params.timeZone).date;

  for (const member of params.input.members) {
    seenEmployees.add(member.employeeId);
    const existing = byEmployeeId.get(member.employeeId);

    if (!existing) {
      await params.workforce.addCrewMembership(params.companyId, params.actorProfileId, {
        crew_id: params.crewId,
        employee_id: member.employeeId,
        role: member.role,
        is_primary: member.primaryCrew,
        starts_on: member.joinedOn || today,
        status: "active",
      });
      continue;
    }

    await params.workforce.updateCrewMembership(params.companyId, params.actorProfileId, existing.id, {
      role: member.role,
      is_primary: member.primaryCrew,
      status: "active",
      ends_on: null,
    });
  }

  for (const membership of existingActive) {
    if (seenEmployees.has(membership.employee_id)) {
      continue;
    }

    await params.workforce.endCrewMembership(
      params.companyId,
      params.actorProfileId,
      membership.id,
      today,
    );
  }
}

