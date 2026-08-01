"use client";

import type { WorkspaceIdentity } from "./WorkspaceEnvironment";

type ConnectionLinesProps = {
  workspace: WorkspaceIdentity;
};

export function ConnectionLines({ workspace }: ConnectionLinesProps) {
  return (
    <svg
      aria-hidden="true"
      className="bf-env-lines"
      data-bf-workspace={workspace}
      viewBox="0 0 1200 420"
      preserveAspectRatio="none"
    >
      <path d="M-10 330 C 160 265 330 370 470 292 C 620 205 790 265 930 204 C 1040 158 1120 196 1210 146" />
      <path d="M-20 390 C 130 340 280 410 460 355 C 620 304 760 335 900 282 C 1030 240 1120 256 1220 222" />
      <circle cx="262" cy="320" r="3.5" />
      <circle cx="612" cy="250" r="3" />
      <circle cx="920" cy="194" r="4" />
    </svg>
  );
}
