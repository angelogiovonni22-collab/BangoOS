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
  return t(`employees.recordStatus.${status}`);
}

function availabilityLabel(status: AvailabilityStatus, t: EmployeeStatusPillProps["t"]) {
  return t(`employees.recordAvailability.${status}`);
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
