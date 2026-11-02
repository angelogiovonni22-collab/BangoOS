/** Employee hire and termination dates are calendar dates, without a timezone. */
export function formatEmployeeCalendarDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}
