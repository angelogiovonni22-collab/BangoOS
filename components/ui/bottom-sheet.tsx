"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { LayerManager } from "@/components/bangoflow";
import { SlidePanel } from "@/components/motion";
import { ModalFooter } from "./modal-footer";
import { ModalHeader } from "./modal-header";
import { OverlayBackdrop } from "./overlay-backdrop";
import { PortalHost } from "./portal-host";
import { useTopmostOverlay } from "./overlay-runtime";
import { useBodyScrollLock } from "./use-body-scroll-lock";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  lockBodyScroll?: boolean;
  trapFocus?: boolean;
  backdropLabel?: string;
  className?: string;
  panelClassName?: string;
};

export function BottomSheet({
  open,
  onClose,
  children,
  title,
  description,
  footer,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  closeOnEscape = true,
  closeOnBackdrop = true,
  lockBodyScroll = true,
  trapFocus = true,
  backdropLabel = "Close sheet",
  className,
  panelClassName,
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const isTopmost = useTopmostOverlay(open);

  useBodyScrollLock(open && lockBodyScroll);

  useEffect(() => {
    if (!open || !closeOnEscape || !isTopmost) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeOnEscape, isTopmost, onClose, open]);

  if (!open) {
    return null;
  }

  const resolvedTitleId = title ? ariaLabelledBy || titleId : ariaLabelledBy;
  const resolvedDescriptionId = description ? ariaDescribedBy || descriptionId : ariaDescribedBy;

  return (
    <PortalHost>
      <OverlayBackdrop closeLabel={backdropLabel} onClick={closeOnBackdrop ? onClose : undefined} className="md:hidden" />
      <LayerManager layer="dialog">
        <div className={["fixed inset-x-0 bottom-0 flex items-end md:hidden pointer-events-none", className || ""].filter(Boolean).join(" ")}>
          <SlidePanel
            ref={panelRef}
            open={open}
            from="bottom"
            trapFocus={trapFocus}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            aria-labelledby={resolvedTitleId}
            aria-describedby={resolvedDescriptionId}
            className={[
              "pointer-events-auto w-full max-h-[86vh] overflow-y-auto rounded-t-[18px] border border-b-0 border-[var(--color-border-subtle)] bg-white p-4 shadow-[0_-24px_48px_-28px_rgba(15,23,42,0.5)]",
              panelClassName || "",
            ].filter(Boolean).join(" ")}
          >
            {title || description ? (
              <ModalHeader title={title} description={description} titleId={resolvedTitleId} descriptionId={resolvedDescriptionId} />
            ) : null}
            <div className={title || description ? "mt-4" : ""}>{children}</div>
            {footer ? <ModalFooter className="mt-4">{footer}</ModalFooter> : null}
          </SlidePanel>
        </div>
      </LayerManager>
    </PortalHost>
  );
}