import { Badge } from "@/components/ui";
import type { CrewAvailabilityStatus, CrewStatus } from "@/lib/crews";

type CrewStatusPillProps = {
  status: CrewStatus;
  availability: CrewAvailabilityStatus;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CrewStatusPill({ status, availability, t }: CrewStatusPillProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone={statusTone(status)}>{statusLabel(status, t)}</Badge>
      <Badge tone={availabilityTone(availability)}>{availability === "assigned" ? "Assigned" : "Available"}</Badge>
    </div>
  );
}

function statusLabel(status: CrewStatus, t: CrewStatusPillProps["t"]) {
  if (status === "archived") {
    return "Archived";
  }

  return t(`crews.status.${status}`);
}

function statusTone(status: CrewStatus): "success" | "warning" | "neutral" {
  if (status === "active") {
    return "success";
  }

  return "neutral";
}

function availabilityTone(status: CrewAvailabilityStatus): "success" | "info" | "neutral" {
  if (status === "available") {
    return "success";
  }

  if (status === "assigned") {
    return "info";
  }

  return "neutral";
}
