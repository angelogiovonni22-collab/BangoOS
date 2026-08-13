"use client";

import Link from "next/link";
import { MapPinned } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadBlueprintSourcesForOperationalRecords, type BlueprintOperationalSource } from "@/lib/blueprints/operations";

export function BlueprintSourceLink({ targetType, targetIds }: { targetType: "change_order" | "estimate_line_item" | "task" | "rfi" | "punch_item" | "workforce_assignment"; targetIds: string[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [source, setSource] = useState<BlueprintOperationalSource | null>(null);
  const identity = targetIds.join(",");

  useEffect(() => {
    if (!supabase || !identity) return;
    let active = true;
    void loadBlueprintSourcesForOperationalRecords(supabase, { targetType, targetIds: identity.split(",").filter(Boolean) })
      .then((sources) => { if (active) setSource(sources[0] ?? null); })
      .catch(() => { if (active) setSource(null); });
    return () => { active = false; };
  }, [identity, supabase, targetType]);

  if (!source) return null;
  const href = `/projects/${source.projectId}?tab=blueprints&blueprintVersion=${source.versionId}&blueprintPage=${source.pageNumber}&blueprintAnnotation=${source.annotationId}`;
  return <Link href={href} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100" data-orion-action="blueprints.open-source"><MapPinned size={15} aria-hidden="true" />Open Blueprint source · page {source.pageNumber}</Link>;
}
