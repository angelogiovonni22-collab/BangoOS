"use client";

import type { ReactNode } from "react";
import { resolveDepthClassName, type DepthLayer } from "./DepthTokens";

type LayerManagerProps = {
  children: ReactNode;
  layer?: DepthLayer;
  className?: string;
};

export function resolveLayerClassName(layer: DepthLayer, className?: string) {
  return [resolveDepthClassName(layer), className || ""].filter(Boolean).join(" ");
}

export function LayerManager({ children, layer = "surface", className }: LayerManagerProps) {
  return <div className={resolveLayerClassName(layer, className)} data-bf-layer={layer}>{children}</div>;
}