import { StatusBadge } from "@/components/ui";
import type { DocumentStatus } from "./types";

type DocumentStatusProps = {
  status: DocumentStatus;
  className?: string;
};

export function DocumentStatusBadge({ status, className }: DocumentStatusProps) {
  return <StatusBadge status={status} className={className} />;
}
