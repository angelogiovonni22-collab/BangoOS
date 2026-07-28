import { SearchInput } from "@/components/ui";

type ProjectTimelineSearchProps = {
  value: string;
  onChange: (value: string) => void;
  matchedCount: number;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectTimelineSearch({ value, onChange, matchedCount, t }: ProjectTimelineSearchProps) {
  return (
    <div className="space-y-2">
      <SearchInput
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("projects.intelligenceSearchPlaceholder")}
        aria-label={t("projects.intelligenceSearch")}
      />
      <p className="text-xs text-[var(--color-text-muted)]" aria-live="polite">
        {t("projects.intelligenceSearchMatched", { count: matchedCount })}
      </p>
    </div>
  );
}
