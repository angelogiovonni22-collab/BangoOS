import { Badge } from "@/components/ui";
import type { DailyReportStatus } from "@/lib/daily-reports";

type ReportStatusChipProps = {
  status: DailyReportStatus;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ReportStatusChip({ status, t }: ReportStatusChipProps) {
  return (
    <Badge tone={statusTone(status)}>{t(`dailyReports.status.${status}`)}</Badge>
  );
}

function statusTone(status: DailyReportStatus) {
  if (status === "approved") {
    return "success" as const;
  }

  if (status === "reviewed") {
    return "info" as const;
  }

  if (status === "submitted") {
    return "warning" as const;
  }

  return "neutral" as const;
}
