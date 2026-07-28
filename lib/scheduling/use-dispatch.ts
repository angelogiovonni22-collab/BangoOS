"use client";

import { useMemo, useState } from "react";
import type { DispatchResource, DispatchStatus } from "./types";

export function useDispatch(resources: DispatchResource[]) {
  const [project, setProject] = useState("all");
  const [trade, setTrade] = useState("all");
  const [shift, setShift] = useState<"all" | "day" | "swing" | "night">("all");
  const [status, setStatus] = useState<"all" | DispatchStatus>("all");
  const [compact, setCompact] = useState(false);

  const filtered = useMemo(() => {
    return resources.filter((item) => {
      const matchesProject = project === "all" || item.relatedProjectId === project;
      const matchesTrade = trade === "all" || item.trade === trade;
      const matchesShift = shift === "all" || item.shift === shift;
      const matchesStatus = status === "all" || item.status === status;
      return matchesProject && matchesTrade && matchesShift && matchesStatus;
    });
  }, [project, resources, shift, status, trade]);

  return {
    project,
    setProject,
    trade,
    setTrade,
    shift,
    setShift,
    status,
    setStatus,
    compact,
    setCompact,
    filtered,
  };
}
