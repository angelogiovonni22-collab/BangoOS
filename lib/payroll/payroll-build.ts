type PayrollPeriod = { period_start: string; period_end: string; status: string };
export function payrollBuildIssue(input: {
  periods: PayrollPeriod[]; start: string; end: string; approvedHours: number; missingRates: number;
}): string | null {
  if (input.periods.some(period => period.period_start === input.start && period.period_end === input.end && period.status !== "void")) {
    return "Payroll already exists for these dates. Open the existing period in Payroll History.";
  }
  if (input.missingRates > 0) return "Set employee payroll rates before building payroll.";
  if (!(input.approvedHours > 0)) return "No approved unprocessed time is available to build payroll.";
  return null;
}
export function payrollBuildError(error: { message: string; code?: string }): string {
  if (error.message.includes("payroll_periods_active_company_dates")) {
    return "Payroll already exists for these dates. Open the existing period in Payroll History.";
  }
  if (error.message.includes("No approved unprocessed time")) return "No approved unprocessed time is available to build payroll.";
  return "Unable to build payroll. Refresh the page and check the selected dates and employee pay settings.";
}
