const formatters = new Map<string, Intl.DateTimeFormat>();

export function resolveScheduleTimeZone(configured: string | null | undefined): string {
  const timeZone = configured?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw new Error("The company scheduling time zone is invalid. Update the company time zone before scheduling work.");
  }
  return timeZone;
}

export function scheduleClock(instant: string, timeZone: string): { date: string; time: string } {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function nextScheduleDate(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** Convert a company wall-clock value, rejecting DST gaps and repeated clock times. */
export function scheduleInstant(date: string, time: string, timeZone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error("Enter a valid assignment date and time.");
  }
  const nominal = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(nominal) || new Date(nominal).toISOString().slice(0, 10) !== date) {
    throw new Error("Enter a valid assignment date and time.");
  }
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = nominal + hours * 3_600_000;
    const clock = scheduleClock(new Date(sample).toISOString(), timeZone);
    offsets.add(Date.parse(`${clock.date}T${clock.time}:00Z`) - sample);
  }
  const matches = [...offsets].map((offset) => new Date(nominal - offset).toISOString()).filter((instant) => {
    const clock = scheduleClock(instant, timeZone);
    return clock.date === date && clock.time === time;
  });
  if (matches.length !== 1) {
    throw new Error(matches.length === 0
      ? `That clock time does not exist in ${timeZone} because of a time-zone change. Choose another time.`
      : `That clock time occurs twice in ${timeZone} because of a time-zone change. Choose an unambiguous time.`);
  }
  return matches[0];
}

export function createScheduleWindow(date: string, startTime: string, endTime: string, timeZone: string) {
  const startsAt = scheduleInstant(date, startTime, timeZone);
  const endDate = endTime <= startTime ? nextScheduleDate(date) : date;
  const endsAt = scheduleInstant(endDate, endTime, timeZone);
  return { startsAt, endsAt };
}

export function moveScheduleWindow(params: {
  startsAt: string; endsAt: string; timeZone: string; date?: string;
  startTime?: string; endTime?: string; shift?: "day" | "swing" | "night";
}) {
  if (!params.date && !params.startTime && !params.endTime && !params.shift) {
    return { startsAt: params.startsAt, endsAt: params.endsAt };
  }
  const current = scheduleClock(params.startsAt, params.timeZone);
  const date = params.date ?? current.date;
  const shiftStarts = { day: "07:00", swing: "15:00", night: "23:00" };
  const startTime = params.startTime ?? (params.shift ? shiftStarts[params.shift] : current.time);
  const startsAt = !params.date && !params.startTime && !params.shift
    ? params.startsAt : scheduleInstant(date, startTime, params.timeZone);
  if (params.endTime) {
    const endDate = params.endTime <= startTime ? nextScheduleDate(date) : date;
    return { startsAt, endsAt: scheduleInstant(endDate, params.endTime, params.timeZone) };
  }
  const duration = new Date(params.endsAt).getTime() - new Date(params.startsAt).getTime();
  return { startsAt, endsAt: new Date(new Date(startsAt).getTime() + duration).toISOString() };
}
