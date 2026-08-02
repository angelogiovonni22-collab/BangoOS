import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createWorkforceRepository } from "../workforce-repository";
import { normalizeWorkforceFindings } from "./workforce-finding-normalizer";
import { evaluateWorkforceSignals } from "./workforce-signal-evaluator";
import type {
  WorkforceFreshnessConfig,
  WorkforceIntelligenceResult,
  WorkforceIntelligenceService,
} from "./workforce-intelligence-types";

export function createWorkforceIntelligenceService(
  supabase: SupabaseClient<Database>,
): WorkforceIntelligenceService {
  const repository = createWorkforceRepository(supabase);

  return {
    async evaluateCompany(companyId, options = {}): Promise<WorkforceIntelligenceResult> {
      if (!companyId) {
        throw new Error("Company scope is required for workforce intelligence evaluation.");
      }

      const now = options.now ?? new Date();

      const [employees, crews, memberships, assignments] = await Promise.all([
        repository.listEmployees(companyId),
        repository.listCrews(companyId),
        repository.listCrewMemberships(companyId),
        repository.listWorkforceAssignments(companyId),
      ]);

      const [projectsResult, phasesResult, tasksResult, profilesResult] = await Promise.allSettled([
        repository.listProjects(companyId),
        repository.listPhases(companyId),
        repository.listTasks(companyId),
        repository.listProfiles(companyId),
      ]);

      const projects = projectsResult.status === "fulfilled" ? projectsResult.value : [];
      const phases = phasesResult.status === "fulfilled" ? phasesResult.value : [];
      const tasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];
      const profiles = profilesResult.status === "fulfilled" ? profilesResult.value : [];

      const partialNotices: string[] = [];

      if (projectsResult.status === "rejected") {
        partialNotices.push("Project records are temporarily unavailable for workforce intelligence.");
      }

      if (phasesResult.status === "rejected") {
        partialNotices.push("Phase records are temporarily unavailable for workforce intelligence.");
      }

      if (tasksResult.status === "rejected") {
        partialNotices.push("Task records are temporarily unavailable for workforce intelligence.");
      }

      if (profilesResult.status === "rejected") {
        partialNotices.push("Profile records are temporarily unavailable for workforce intelligence names.");
      }

      const signalResult = evaluateWorkforceSignals({
        companyId,
        employees,
        crews,
        memberships,
        assignments,
        projects,
        phases,
        tasks,
        profiles,
        now,
        freshness: options.freshness,
        availability: {
          projects: projectsResult.status === "fulfilled" ? "live" : "unavailable",
          phases: phasesResult.status === "fulfilled" ? "live" : "unavailable",
          tasks: tasksResult.status === "fulfilled" ? "live" : "unavailable",
          profiles: profilesResult.status === "fulfilled" ? "live" : "unavailable",
        },
      });

      const findings = normalizeWorkforceFindings({
        companyId,
        signals: signalResult.signals,
      });

      return {
        companyId,
        evaluatedAt: now.toISOString(),
        partialNotices: [...partialNotices, ...signalResult.partialNotices],
        limitations: signalResult.limitations,
        signals: signalResult.signals,
        findings,
      };
    },
  };
}

export type { WorkforceFreshnessConfig };
