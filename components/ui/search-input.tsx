import type { InputHTMLAttributes } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { Input } from "./input";

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export function SearchInput({ className, ...props }: SearchInputProps) {
  const { t } = useI18n();
  const composedClassName = ["pl-10", className || ""].filter(Boolean).join(" ");

  return (
    <label className="relative block">
      <span className="sr-only">{t("common.search")}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-muted)]"
      >
        ⌕
      </span>
      <Input type="search" className={composedClassName} {...props} />
    </label>
  );
}
