import type { DailyReportUpsertInput, ValidationResult } from "./types";

export function validateDailyReportInput(input: DailyReportUpsertInput): ValidationResult {
  const errors: string[] = [];

  if (!input.header.projectId) {
    errors.push("dailyReports.validation.projectRequired");
  }

  if (!input.header.date) {
    errors.push("dailyReports.validation.dateRequired");
  }

  if (!input.header.superintendentId) {
    errors.push("dailyReports.validation.superintendentRequired");
  }

  if (input.labor.length === 0) {
    errors.push("dailyReports.validation.laborRequired");
  }

  if (input.workCompleted.length === 0) {
    errors.push("dailyReports.validation.workRequired");
  }

  for (const item of input.labor) {
    if (item.regularHours < 0 || item.overtimeHours < 0) {
      errors.push("dailyReports.validation.hoursInvalid");
      break;
    }
  }

  for (const item of input.workCompleted) {
    if (item.percentComplete < 0 || item.percentComplete > 100) {
      errors.push("dailyReports.validation.percentInvalid");
      break;
    }
  }

  for (const item of input.equipment || []) {
    if (!item.equipmentId.trim()) {
      errors.push("dailyReports.validation.equipmentIdRequired");
      break;
    }

    if (item.runtimeHours < 0 || item.idleHours < 0 || item.downtimeHours < 0) {
      errors.push("dailyReports.validation.equipmentHoursInvalid");
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
