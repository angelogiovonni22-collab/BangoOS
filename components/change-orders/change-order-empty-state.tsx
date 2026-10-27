"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import { EmptyState, getButtonClassName } from "@/components/ui";

export function ChangeOrderDirectoryEmptyState() {
  const { t } = useI18n();
  return (
    <EmptyState
      icon="CO"
      title={t("finance.noChangeOrders")}
      description={t("finance.noChangeOrdersDescription")}
      action={
        <Link href="/change-orders/new" className={getButtonClassName({})}>{t("finance.createChangeOrder")}</Link>
      }
    />
  );
}

export function ChangeOrderDirectoryFilteredEmptyState() {
  const { t } = useI18n();
  return (
    <EmptyState
      icon="?"
      title={t("finance.noChangeOrdersFiltered")}
      description={t("finance.noChangeOrdersFilteredDescription")}
      compact
    />
  );
}
