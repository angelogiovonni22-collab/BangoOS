import Link from "next/link";
import { Button, Input } from "@/components/ui";
import type { ExecutiveCommandDefinition, ExecutiveCommandResult } from "@/lib/orion/executive-brief-types";

type ExecutiveCommandBarProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  quickCommands: ExecutiveCommandDefinition[];
  onQuickCommand: (command: string) => void;
  result: ExecutiveCommandResult | null;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ExecutiveCommandBar({ value, onValueChange, onSubmit, quickCommands, onQuickCommand, result, t }: ExecutiveCommandBarProps) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t("orion.commandTitle")}</p>
        <p className="text-xs text-[var(--color-text-secondary)]">{t("orion.commandDescription")}</p>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Input value={value} onChange={(event) => onValueChange(event.target.value)} placeholder={t("orion.commandPlaceholder")} />
        <Button type="submit">{t("orion.commandRun")}</Button>
      </form>

      <div className="flex flex-wrap gap-2">
        {quickCommands.map((command) => (
          <Button key={command.id} type="button" size="sm" variant="outline" onClick={() => onQuickCommand(command.example)}>
            {command.label}
          </Button>
        ))}
      </div>

      {result ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3 text-sm text-[var(--color-text-secondary)]">
          <p>{result.message}</p>
          {result.href ? (
            <Link href={result.href} className="mt-2 inline-flex text-sm font-semibold text-[var(--color-brand-700)] hover:text-[var(--color-brand-800)]">
              {t("orion.commandOpenRoute")}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}