"use client";

import { useMemo, useState } from "react";
import { buildLaborForecast } from "./forecast-service";
import type { LaborForecastRange, ScheduleAssignment } from "./types";

export function useLaborForecast(assignments: ScheduleAssignment[]) {
  const [range, setRange] = useState<LaborForecastRange>("7d");

  const forecast = useMemo(() => buildLaborForecast(assignments, range), [assignments, range]);

  return {
    range,
    setRange,
    forecast,
  };
}
