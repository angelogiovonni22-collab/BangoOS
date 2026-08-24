import { createSupabaseSchedulingService } from "./supabase-service";
import type {
  AssignmentDraft,
  DispatchStatus,
  ScheduleAssignment,
  SchedulingPayload,
} from "./types";

export type SchedulingService = {
  getScheduling: () => Promise<SchedulingPayload>;
  createAssignment: (draft: AssignmentDraft) => Promise<SchedulingPayload>;
  updateAssignment: (assignmentId: string, draft: AssignmentDraft) => Promise<SchedulingPayload>;
  cancelAssignment: (assignmentId: string) => Promise<SchedulingPayload>;
  moveDispatchResource: (dispatchId: string, status: DispatchStatus, delayReason: string | null) => Promise<SchedulingPayload>;
  assignOpenShift: (openShiftId: string, employeeId: string | null, crewId: string | null) => Promise<SchedulingPayload>;
  dismissOpenShift: (openShiftId: string) => Promise<SchedulingPayload>;
  resolveConflict: (conflictId: string, status: "acknowledged" | "dismissed" | "resolved") => Promise<SchedulingPayload>;
  acceptInsight: (insightId: string) => Promise<SchedulingPayload>;
  dismissInsight: (insightId: string) => Promise<SchedulingPayload>;
  moveAssignment: (assignmentId: string, changes: Partial<Pick<ScheduleAssignment, "date" | "shift" | "assignedCrewIds" | "assignedEmployeeIds" | "startTime" | "endTime">>) => Promise<SchedulingPayload>;
};

export function createSchedulingService(): SchedulingService {
  return createSupabaseSchedulingService();
}
