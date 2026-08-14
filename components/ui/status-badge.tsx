import { Badge } from "./badge";
import { getEnterpriseStatusTone, type EnterpriseStatusTone } from "@/lib/design-system/tokens";

const incidentStatusTone: EnterpriseStatusTone = "danger";

type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status.trim().toLowerCase();
  const tone = normalizedStatus === "incident" ? incidentStatusTone : getEnterpriseStatusTone(normalizedStatus);

  return (
    <Badge tone={tone} className={["gap-1.5 shadow-[0_1px_2px_rgb(15_23_42/0.06)]", className || ""].filter(Boolean).join(" ")}>
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80 shadow-[0_0_0_2px_currentColor] [box-shadow:0_0_0_2px_color-mix(in_srgb,currentColor_15%,transparent)]" />
      {status}
    </Badge>
  );
}
