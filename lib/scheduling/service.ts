import {
  acceptInsight,
  assignOpenShift,
  createAssignment,
  dismissInsight,
  getSchedulingPayload,
  moveAssignment,
  moveDispatchResource,
  resolveConflict,
} from "./mock-data";
import type {
  AssignmentDraft,
  DispatchStatus,
  ScheduleAssignment,
  SchedulingPayload,
} from "./types";

export type SchedulingService = {
  getScheduling: () => Promise<SchedulingPayload>;
  createAssignment: (draft: AssignmentDraft) => Promise<SchedulingPayload>;
  moveDispatchResource: (dispatchId: string, status: DispatchStatus, delayReason: string | null) => Promise<SchedulingPayload>;
  assignOpenShift: (openShiftId: string, employeeId: string | null, crewId: string | null) => Promise<SchedulingPayload>;
  resolveConflict: (conflictId: string, status: "acknowledged" | "dismissed" | "resolved") => Promise<SchedulingPayload>;
  acceptInsight: (insightId: string) => Promise<SchedulingPayload>;
  dismissInsight: (insightId: string) => Promise<SchedulingPayload>;
  moveAssignment: (assignmentId: string, changes: Partial<Pick<ScheduleAssignment, "date" | "shift" | "assignedCrewIds" | "assignedEmployeeIds" | "startTime" | "endTime">>) => Promise<SchedulingPayload>;
};

export function createSchedulingService(): SchedulingService {
  return {
    async getScheduling() {
      return getSchedulingPayload();
    },

    async createAssignment(draft) {
      return createAssignment(draft);
    },

    async moveDispatchResource(dispatchId, status, delayReason) {
      return moveDispatchResource(dispatchId, status, delayReason);
    },

    async assignOpenShift(openShiftId, employeeId, crewId) {
      return assignOpenShift(openShiftId, employeeId, crewId);
    },

    async resolveConflict(conflictId, status) {
      return resolveConflict(conflictId, status);
    },

    async acceptInsight(insightId) {
      return acceptInsight(insightId);
    },

    async dismissInsight(insightId) {
      return dismissInsight(insightId);
    },

    async moveAssignment(assignmentId, changes) {
      return moveAssignment(assignmentId, changes);
    },
  };
}
