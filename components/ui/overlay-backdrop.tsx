"use client";

import type { MouseEventHandler } from "react";
import { LayerManager } from "@/components/bangoflow";

type OverlayBackdropProps = {
  closeLabel: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
};

export function OverlayBackdrop({ closeLabel, onClick, className }: OverlayBackdropProps) {
  return (
    <LayerManager layer="backdrop">
      <button
        type="button"
        aria-label={closeLabel}
        className={[
          "fixed inset-0 w-full bg-slate-950/50",
          className || "",
        ].filter(Boolean).join(" ")}
        onClick={onClick}
      />
    </LayerManager>
  );
}