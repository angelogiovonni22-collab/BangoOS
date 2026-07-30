import { Badge } from "@/components/ui";

export function UnitSystemBadge({ isSystem }: { isSystem: boolean }) {
  if (isSystem) {
    return <Badge tone="neutral">System</Badge>;
  }

  return <Badge tone="brand">Company</Badge>;
}
