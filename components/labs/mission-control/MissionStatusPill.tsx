import type { MissionSeverity } from "@/lib/labs/mission-control/types";
import { severityClass } from "./mission-theme";

type MissionStatusPillProps = {
  label: string;
  severity: MissionSeverity;
};

export function MissionStatusPill({ label, severity }: MissionStatusPillProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.09em]",
        severityClass(severity),
      ].join(" ")}
    >
      {label}
    </span>
  );
}
