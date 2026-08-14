"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMotionPreferences } from "@/components/motion";
import { AmbientGrid } from "./AmbientGrid";
import { BlueprintSurface } from "./BlueprintSurface";
import { CarbonSurface } from "./CarbonSurface";
import { ConnectionLines } from "./ConnectionLines";
import { GlassSurface } from "./GlassSurface";
import { LightingSystem } from "./LightingSystem";
import { MissionControlSurface } from "./MissionControlSurface";
import { SurfaceOverlay } from "./SurfaceOverlay";

export type WorkspaceIdentity = "mission-control" | "blueprint" | "relationship" | "executive" | "camera";
export type WorkspaceReactionPhase = "idle" | "navigation" | "data" | "ai" | "alert";

type WorkspaceEnvironmentProps = {
  workspace: WorkspaceIdentity;
  routeKey: string;
  className?: string;
  children: ReactNode;
};

const REACTION_RESET_MS = 760;
const MUTATION_GUARD_MS = 380;

export function WorkspaceEnvironment({ workspace, routeKey, className, children }: WorkspaceEnvironmentProps) {
  const { reducedMotion } = useMotionPreferences();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const lastMutationRef = useRef(0);
  const [phase, setPhase] = useState<WorkspaceReactionPhase>("idle");

  const triggerReaction = useCallback((nextPhase: WorkspaceReactionPhase) => {
    if (reducedMotion) {
      return;
    }

    const now = Date.now();

    if (nextPhase === "data" && now - lastMutationRef.current < MUTATION_GUARD_MS) {
      return;
    }

    if (nextPhase === "data") {
      lastMutationRef.current = now;
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setPhase(nextPhase);

    timeoutRef.current = window.setTimeout(() => {
      setPhase("idle");
      timeoutRef.current = null;
    }, REACTION_RESET_MS);
  }, [reducedMotion]);

  useEffect(() => {
    triggerReaction("navigation");
  }, [routeKey, triggerReaction]);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }

    const root = contentRef.current;

    if (!root) {
      return;
    }

    const observer = new MutationObserver((records) => {
      let sawDataMutation = false;

      for (const record of records) {
        if (record.type === "childList") {
          if (record.addedNodes.length > 0 || record.removedNodes.length > 0) {
            sawDataMutation = true;
          }
        }

        if (record.type === "characterData" || record.type === "attributes") {
          sawDataMutation = true;
        }
      }

      if (findAlertSignal(root)) {
        triggerReaction("alert");
        return;
      }

      if (findAiSignal(root)) {
        triggerReaction("ai");
        return;
      }

      if (sawDataMutation) {
        triggerReaction("data");
      }
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-ai-active", "data-alert-level", "aria-live", "role", "class"],
    });

    return () => {
      observer.disconnect();
    };
  }, [reducedMotion, triggerReaction]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const material = useMemo(() => {
    if (workspace === "mission-control") {
      return MissionControlSurface;
    }

    if (workspace === "blueprint") {
      return BlueprintSurface;
    }

    if (workspace === "executive") {
      return CarbonSurface;
    }

    return GlassSurface;
  }, [workspace]);

  const MaterialSurface = material;
  const visiblePhase: WorkspaceReactionPhase = reducedMotion ? "idle" : phase;

  return (
    <div
      className={[
        "bf-workspace-environment",
        reducedMotion ? "bf-no-motion" : "",
        className || "",
      ].filter(Boolean).join(" ")}
      data-bf-workspace={workspace}
      data-bf-phase={visiblePhase}
    >
      <AmbientGrid workspace={workspace} />
      <ConnectionLines workspace={workspace} />
      <LightingSystem workspace={workspace} phase={visiblePhase} />
      <SurfaceOverlay workspace={workspace} />
      <MaterialSurface>
        <div ref={contentRef} className="bf-env-content">
          {children}
        </div>
      </MaterialSurface>
    </div>
  );
}

function findAiSignal(root: ParentNode) {
  return Boolean(root.querySelector(".bf-intel-activity, [data-ai-active='true'], [data-ai-state='working']"));
}

function findAlertSignal(root: ParentNode) {
  return Boolean(root.querySelector("[role='alert'], [aria-live='assertive'], [data-alert-level], .bf-pulse-critical, .bf-pulse-warning"));
}
