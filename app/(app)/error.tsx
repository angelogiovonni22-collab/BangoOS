"use client";

import { Button, ErrorState } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();

  return (
    <ErrorState
      title={t("common.unexpectedErrorTitle")}
      description={t("common.unexpectedErrorDescription")}
      action={
        <Button type="button" onClick={reset}>
          {t("common.tryAgain")}
        </Button>
      }
    />
  );
}
