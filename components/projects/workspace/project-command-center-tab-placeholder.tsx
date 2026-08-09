"use client";

import { useEffect, useMemo, useState } from "react";
import { Layers3 } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { ProjectActivityWorkspace } from "./project-activity-workspace";

type ProjectCommandCenterTabPlaceholderProps = {
  tabLabel: string;
};

type ActivityIdentity = {
  userId: string;
  userName: string;
};

export function ProjectCommandCenterTabPlaceholder({ tabLabel }: ProjectCommandCenterTabPlaceholderProps) {
  const normalizedTab = tabLabel.toLowerCase();
  const params = useParams<{ id?: string | string[] }>();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const projectId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const tabParam = searchParams.get("tab");
  const isActivityTab = tabParam === "activity" || tabParam === "timeline";
  const [activityIdentity, setActivityIdentity] = useState<ActivityIdentity | null>(null);
  const [activityIdentityResolved, setActivityIdentityResolved] = useState(false);

  useEffect(() => {
    let isSubscribed = true;

    if (!isActivityTab || !projectId) {
      setActivityIdentity(null);
      setActivityIdentityResolved(false);
      return () => {
        isSubscribed = false;
      };
    }

    const loadActivityIdentity = async () => {
      setActivityIdentityResolved(false);

      const workspaceResult = await resolveWorkspaceContext(supabase);

      if (!workspaceResult.context) {
        if (isSubscribed) {
          setActivityIdentity(null);
          setActivityIdentityResolved(true);
        }
        return;
      }

      const { userId } = workspaceResult.context;
      let userName = "BangoOS User";

      if (supabase) {
        const profileResponse = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", userId)
          .maybeSingle<{ first_name: string | null; last_name: string | null }>();

        if (!profileResponse.error && profileResponse.data) {
          const fullName = `${profileResponse.data.first_name?.trim() || ""} ${profileResponse.data.last_name?.trim() || ""}`.trim();
          if (fullName) {
            userName = fullName;
          }
        }
      }

      if (isSubscribed) {
        setActivityIdentity({ userId, userName });
        setActivityIdentityResolved(true);
      }
    };

    void loadActivityIdentity();

    return () => {
      isSubscribed = false;
    };
  }, [isActivityTab, projectId, supabase]);

  if (isActivityTab && projectId) {
    if (!activityIdentityResolved) {
      return (
        <section className="min-w-0 rounded-[18px] border border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--bos-bg-workspace-card),var(--color-neutral-50))] p-6 shadow-[var(--bos-shadow-workspace-card)]">
          <div className="h-24 animate-pulse rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)]" />
        </section>
      );
    }

    if (activityIdentity) {
      return (
        <ProjectActivityWorkspace
          projectId={projectId}
          localeTag={document.documentElement.lang === "es" ? "es-ES" : "en-US"}
          currentUserId={activityIdentity.userId}
          currentUserName={activityIdentity.userName}
        />
      );
    }
  }

  return (
    <section className="min-w-0 rounded-[18px] border border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--bos-bg-workspace-card),var(--color-neutral-50))] p-6 shadow-[var(--bos-shadow-workspace-card)]">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3 rounded-[12px] border border-[#d3e2f2] bg-[#f7fbff] px-4 py-3">
        <p className="min-w-0 break-words text-section-title font-bold text-[var(--bos-text-strong-on-light)]">{tabLabel}</p>
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--bos-border-light-strong)] bg-white text-[var(--bos-text-medium-on-light)]">
            <Layers3 size={14} aria-hidden="true" />
          </span>
          Ready
        </span>
      </div>

      <div className="rounded-[12px] border border-dashed border-[var(--bos-border-light-strong)] bg-[var(--color-neutral-50)] px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--bos-border-light-strong)] bg-white text-[var(--bos-text-medium-on-light)]">
            <Layers3 size={16} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">No {normalizedTab} records available yet</p>
            <p className="mt-1 text-sm font-medium leading-6 text-[var(--bos-text-medium-on-light)]">Data will appear here as soon as your team starts logging {normalizedTab} activity for this project.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
