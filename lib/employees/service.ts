import {
  createEmployee,
  getCrewOptions,
  getEmployeeById,
  getEmployeeDashboardSummary,
  listEmployees,
  updateEmployee,
} from "./mock-data";
import type {
  Employee,
  EmployeeDashboardSummary,
  EmployeeFilters,
  EmployeeListResult,
  UpsertEmployeeInput,
} from "./types";

export type EmployeeService = {
  getEmployees: (filters: EmployeeFilters) => Promise<EmployeeListResult>;
  getSummary: () => Promise<EmployeeDashboardSummary>;
  getEmployee: (employeeId: string) => Promise<Employee | null>;
  getCrewOptions: () => Promise<string[]>;
  createEmployee: (input: UpsertEmployeeInput) => Promise<Employee>;
  updateEmployee: (employeeId: string, input: UpsertEmployeeInput) => Promise<Employee | null>;
};

export function createEmployeeService(): EmployeeService {
  return {
    async getEmployees(filters) {
      return listEmployees(filters);
    },

    async getSummary() {
      return getEmployeeDashboardSummary();
    },

    async getEmployee(employeeId) {
      return getEmployeeById(employeeId);
    },

    async getCrewOptions() {
      return getCrewOptions();
    },

    async createEmployee(input) {
      return createEmployee(input);
    },

    async updateEmployee(employeeId, input) {
      return updateEmployee(employeeId, input);
    },
  };
}
