import {
  createCrew,
  getCrewById,
  getCrewDashboardSummary,
  getCrewEmployeeOptions,
  getCrewSpecialtyOptions,
  getProjectCrewAssignments,
  listCrews,
  updateCrew,
} from "./mock-data";
import type {
  Crew,
  CrewDashboardSummary,
  CrewEmployeeOption,
  CrewFilters,
  CrewListResult,
  ProjectCrewAssignmentSummary,
  UpsertCrewInput,
} from "./types";

export type CrewService = {
  getCrews: (filters: CrewFilters) => Promise<CrewListResult>;
  getSummary: () => Promise<CrewDashboardSummary>;
  getCrew: (crewId: string) => Promise<Crew | null>;
  getSpecialtyOptions: () => Promise<string[]>;
  getEmployeeOptions: () => Promise<CrewEmployeeOption[]>;
  getCrewsForProject: (projectName: string) => Promise<ProjectCrewAssignmentSummary[]>;
  createCrew: (input: UpsertCrewInput) => Promise<Crew>;
  updateCrew: (crewId: string, input: UpsertCrewInput) => Promise<Crew | null>;
};

export function createCrewService(): CrewService {
  return {
    async getCrews(filters) {
      return listCrews(filters);
    },

    async getSummary() {
      return getCrewDashboardSummary();
    },

    async getCrew(crewId) {
      return getCrewById(crewId);
    },

    async getSpecialtyOptions() {
      return getCrewSpecialtyOptions();
    },

    async getEmployeeOptions() {
      return getCrewEmployeeOptions();
    },

    async getCrewsForProject(projectName) {
      return getProjectCrewAssignments(projectName);
    },

    async createCrew(input) {
      return createCrew(input);
    },

    async updateCrew(crewId, input) {
      return updateCrew(crewId, input);
    },
  };
}
