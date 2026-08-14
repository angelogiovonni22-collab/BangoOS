"use client";

import { useEffect, useMemo, useState } from "react";
import { FadeIn, IntelligenceActivity } from "@/components/motion";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceContext } from "@/lib/supabase/workspace";
import type { DashboardSectionErrors, ExecutiveDashboardData } from "@/lib/dashboard/types";
import { buildExecutiveBrief, routeExecutiveCommand } from "@/lib/orion/executive-brief-service";
import type { ExecutiveBrief, ExecutiveCommandResult } from "@/lib/orion/executive-brief-types";
import { ExecutiveCommandBar } from "./ExecutiveCommandBar";
import { ExecutiveGreeting } from "./ExecutiveGreeting";
import { ExecutiveNotificationStrip } from "./ExecutiveNotificationStrip";
import { ExecutivePriorityList } from "./ExecutivePriorityList";
import { ExecutiveStatus } from "./ExecutiveStatus";

type ExecutiveIntelligenceBarProps = {
  companyName: string | null;
  workspaceContext: WorkspaceContext | null;
  dashboardData: ExecutiveDashboardData;
  dashboardSectionErrors: DashboardSectionErrors;
  isDashboardLoading: boolean;
  localeTag: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ExecutiveIntelligenceBar({
  companyName,
  workspaceContext,
  dashboardData,
  dashboardSectionErrors,
  isDashboardLoading,
  localeTag,
  t,
}: ExecutiveIntelligenceBarProps) {
  const supabase = useMemo(() => createClient(), []);
  const [brief, setBrief] = useState<ExecutiveBrief | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [commandValue, setCommandValue] = useState("");
  const [commandResult, setCommandResult] = useState<ExecutiveCommandResult | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    const run = async () => {
      if (!supabase || !workspaceContext) {
        if (isSubscribed) {
          setBrief(null);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const nextBrief = await buildExecutiveBrief({
          supabase,
          companyId: workspaceContext.companyId,
          companyName,
          companyRole: workspaceContext.role,
          dashboardData,
          dashboardSectionErrors,
          localeTag,
          t,
        });

        if (!isSubscribed) {
          return;
        }

        setBrief(nextBrief);
      } catch (error) {
        if (!isSubscribed) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : t("orion.loadError"));
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      isSubscribed = false;
    };
  }, [companyName, dashboardData, dashboardSectionErrors, localeTag, supabase, t, workspaceContext]);

  const busy = isDashboardLoading || isLoading;

  return (
    <FadeIn delayMs={18} distancePx={6}>
      <Card as="section" variant="elevated" className="overflow-hidden">
        <CardHeader className="bg-[var(--color-surface-subtle)]/50">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            {brief ? <ExecutiveGreeting greeting={brief.greeting} /> : <ExecutiveGreeting greeting={{ eyebrow: t("orion.executiveEyebrow"), title: t("orion.loadingTitle"), description: t("orion.loadingDescription") }} />}
            {brief ? <ExecutiveStatus state={brief.readinessState} generatedAt={brief.generatedAt} localeTag={localeTag} t={t} /> : null}
          </div>
          <div className="pt-2">
            <IntelligenceActivity active={busy} label={t("orion.loadingLabel")} className="w-fit" />
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-5">
          {errorMessage ? (
            <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
              {errorMessage}
            </p>
          ) : null}

          {brief ? (
            <>
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {brief.companySummary.items.map((item) => (
                  <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-3 shadow-[var(--shadow-small)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{item.label}</p>
                    <p className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">{item.value}</p>
                  </article>
                ))}
              </section>

              <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
                <div className="space-y-4">
                  <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{brief.companySummary.headline}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{brief.healthSummary.headline}</p>
                  </section>
                  <ExecutivePriorityList items={brief.priorityItems} t={t} />
                </div>

                <div className="space-y-4">
                  <ExecutiveCommandBar
                    value={commandValue}
                    onValueChange={setCommandValue}
                    onSubmit={() => {
                      if (!brief) {
                        return;
                      }

                      setCommandResult(routeExecutiveCommand(commandValue, brief, t));
                    }}
                    quickCommands={brief.quickCommands}
                    onQuickCommand={(command) => {
                      setCommandValue(command);
                      setCommandResult(routeExecutiveCommand(command, brief, t));
                    }}
                    result={commandResult}
                    t={t}
                  />
                  <ExecutiveNotificationStrip notifications={brief.notifications} t={t} />
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </FadeIn>
  );
}