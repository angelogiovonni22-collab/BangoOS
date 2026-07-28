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
      <Badge tone={statusTone(status)}>{t(`crews.status.${status}`)}</Badge>
      <Badge tone={availabilityTone(availability)}>{t(`crews.availability.${availability}`)}</Badge>
    </div>
  );
}

function statusTone(status: CrewStatus): "success" | "warning" | "neutral" {
  if (status === "active") {
    return "success";
  }

  if (status === "standby") {
    return "warning";
  }

  return "neutral";
}

function availabilityTone(status: CrewAvailabilityStatus): "success" | "info" | "warning" | "neutral" {
  if (status === "available") {
    return "success";
  }

  if (status === "assigned") {
    return "info";
  }

  if (status === "training") {
    return "warning";
  }

  return "neutral";
}
