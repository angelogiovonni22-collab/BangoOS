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
      <Badge tone={employmentTone(employmentStatus)}>{t(`employees.employmentStatus.${employmentStatus}`)}</Badge>
      <Badge tone={availabilityTone(availabilityStatus)}>{t(`employees.availabilityStatus.${availabilityStatus}`)}</Badge>
    </div>
  );
}

function employmentTone(status: EmploymentStatus): "success" | "warning" | "neutral" {
  if (status === "active") {
    return "success";
  }

  if (status === "on_leave") {
    return "warning";
  }

  return "neutral";
}

function availabilityTone(status: AvailabilityStatus): "success" | "info" | "neutral" {
  if (status === "available") {
    return "success";
  }

  if (status === "assigned") {
    return "info";
  }

  return "neutral";
}
