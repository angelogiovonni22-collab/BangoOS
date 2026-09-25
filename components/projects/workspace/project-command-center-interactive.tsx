"use client";

import type { ComponentProps } from "react";
import { ProjectCommandCenterFoundation as BaseProjectCommandCenterFoundation } from "./project-command-center-foundation";

type Props = ComponentProps<typeof BaseProjectCommandCenterFoundation>;

export function ProjectCommandCenterFoundation(props: Props) {
  return <BaseProjectCommandCenterFoundation {...props} />;
}
