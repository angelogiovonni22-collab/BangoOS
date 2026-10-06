/** Local calendar date used by field reports and dashboard day boundaries. */
export function dailyReportDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function previousDailyReportDate(date = new Date()): string {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return dailyReportDate(previous);
}
