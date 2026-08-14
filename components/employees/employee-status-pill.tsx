import { Badge } from "@/components/ui";
import type { AvailabilityStatus, EmploymentStatus } from "@/lib/employees";

type EmployeeStatusPillProps = {
  employmentStatus: EmploymentStatus;
  availabilityStatus: AvailabilityStatus;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function EmployeeStatusPill({ employmentStatus, availabilityStatus, t }: EmployeeStatusPillProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone={employmentTone(employmentStatus)}>{employmentLabel(employmentStatus, t)}</Badge>
      <Badge tone={availabilityTone(availabilityStatus)}>{availabilityLabel(availabilityStatus, t)}</Badge>
    </div>
  );
}

function employmentLabel(status: EmploymentStatus, t: EmployeeStatusPillProps["t"]) {
  if (status === "leave") {
    return "On leave";
  }

  if (status === "terminated") {
    return "Terminated";
  }

  return t(`employees.employmentStatus.${status}`);
}

function availabilityLabel(status: AvailabilityStatus, t: EmployeeStatusPillProps["t"]) {
  if (status === "unavailable") {
    return "Unavailable";
  }

  if (status === "restricted") {
    return "Restricted";
  }

  if (status === "unknown") {
    return "Unknown";
  }

  return t(`employees.availabilityStatus.${status}`);
}

function employmentTone(status: EmploymentStatus): "success" | "warning" | "neutral" {
  if (status === "active") {
    return "success";
  }

  if (status === "leave") {
    return "warning";
  }

  return "neutral";
}

function availabilityTone(status: AvailabilityStatus): "success" | "info" | "warning" | "neutral" {
  if (status === "available") {
    return "success";
  }

  if (status === "assigned") {
    return "info";
  }

  if (status === "restricted") {
    return "warning";
  }

  return "neutral";
}
