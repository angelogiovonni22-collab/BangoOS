import type { DailyReportStatus } from "@/lib/daily-reports";
import type { WorkforceOperationsDashboardData, WorkforceShiftStatus } from "./workforce-operations-types";

export type CrewCheckInAction = "start_shift" | "end_shift" | "break" | "lunch" | "return_to_work";

export type DailyChecklist = {
  safetyBriefing: boolean;
  ppeVerification: boolean;
  equipmentInspection: boolean;
  dailyGoals: string;
  supervisorNotes: string;
  updatedAt: string | null;
};

export type MobileDailyReportDraft = {
  photos: string[];
  notes: string;
  completedWork: string;
  delays: string;
  materialsUsed: string;
  safetyObservations: string;
};

export type CrewDirectoryEntry = {
  employeeId: string;
  employeeName: string;
  crewName: string | null;
  projectName: string | null;
  phone: string | null;
};

export type EquipmentCheckoutRecord = {
  id: string;
  crewId: string;
  equipmentIds: string[];
  conditionNotes: string;
  checkedOutAt: string;
  returnedAt: string | null;
};

export type OfflineQueueItem = {
  id: string;
  type: "check_in" | "checklist" | "mobile_report" | "equipment_checkout" | "equipment_return";
  payload: Record<string, unknown>;
  createdAt: string;
  status: "queued" | "synced" | "failed";
};

export type OfflineQueueProvider = {
  enqueue: (item: Omit<OfflineQueueItem, "id" | "createdAt" | "status">) => Promise<OfflineQueueItem>;
  list: () => Promise<OfflineQueueItem[]>;
  setStatus?: (id: string, status: OfflineQueueItem["status"]) => Promise<void>;
  remove?: (id: string) => Promise<void>;
};

export type OfflineSyncProvider = {
  getStatus: () => Promise<{ state: "idle" | "pending" | "syncing"; lastSyncedAt: string | null }>;
};

export type OfflineConflictResolutionProvider = {
  listConflicts: () => Promise<Array<{ id: string; entityType: string; message: string; createdAt: string }>>;
};

export type CrewCheckInProvider = {
  logAction: (input: { crewId: string; action: CrewCheckInAction; at: string }) => Promise<void>;
};

export type EquipmentCheckoutProvider = {
  createCheckout: (input: { crewId: string; equipmentIds: string[]; conditionNotes: string; at: string }) => Promise<EquipmentCheckoutRecord>;
  returnEquipment: (input: { checkoutId: string; conditionNotes: string; at: string }) => Promise<EquipmentCheckoutRecord | null>;
  list: () => Promise<EquipmentCheckoutRecord[]>;
};

export type ForemanDashboardData = {
  generatedAt: string;
  workforce: WorkforceOperationsDashboardData;
  weather: string;
  quickActions: Array<{ id: string; label: string }>;
  crewDirectory: CrewDirectoryEntry[];
  checklistByCrew: Record<string, DailyChecklist>;
  equipmentCheckouts: EquipmentCheckoutRecord[];
  offline: {
    queue: OfflineQueueItem[];
    sync: { state: "idle" | "pending" | "syncing"; lastSyncedAt: string | null };
    conflicts: Array<{ id: string; entityType: string; message: string; createdAt: string }>;
  };
};

export type SubmitMobileDailyReportInput = {
  crewId: string;
  reportDate: string;
  status: DailyReportStatus;
  draft: MobileDailyReportDraft;
};

export type MobileFieldOperationsService = {
  getForemanDashboard: () => Promise<ForemanDashboardData>;
  runCheckInAction: (input: { crewId: string; action: CrewCheckInAction }) => Promise<void>;
  saveDailyChecklist: (input: { crewId: string; checklist: DailyChecklist }) => Promise<void>;
  submitMobileDailyReport: (input: SubmitMobileDailyReportInput) => Promise<{ reportId: string }>;
  checkoutEquipment: (input: { crewId: string; equipmentIds: string[]; conditionNotes: string }) => Promise<EquipmentCheckoutRecord>;
  returnEquipment: (input: { checkoutId: string; conditionNotes: string }) => Promise<EquipmentCheckoutRecord | null>;
  syncOfflineActions: () => Promise<{ synced: number; failed: number }>;
  retryOfflineAction: (id: string) => Promise<{ synced: number; failed: number }>;
  discardOfflineAction: (id: string) => Promise<void>;
};

export function toShiftStatus(action: CrewCheckInAction): WorkforceShiftStatus {
  if (action === "start_shift") return "shift_started";
  if (action === "end_shift") return "finished";
  if (action === "break") return "break";
  if (action === "lunch") return "lunch";
  return "working";
}

export function createEmptyChecklist(): DailyChecklist {
  return {
    safetyBriefing: false,
    ppeVerification: false,
    equipmentInspection: false,
    dailyGoals: "",
    supervisorNotes: "",
    updatedAt: null,
  };
}

export function createEmptyMobileDailyReportDraft(): MobileDailyReportDraft {
  return {
    photos: [],
    notes: "",
    completedWork: "",
    delays: "",
    materialsUsed: "",
    safetyObservations: "",
  };
}
