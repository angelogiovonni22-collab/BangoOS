"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { LayerManager } from "@/components/bangoflow";
import { FadeIn, useFocusTrap } from "@/components/motion";
import { ModalFooter } from "./modal-footer";
import { ModalHeader } from "./modal-header";
import { OverlayBackdrop } from "./overlay-backdrop";
import { PortalHost } from "./portal-host";
import { useTopmostOverlay } from "./overlay-runtime";
import { useBodyScrollLock } from "./use-body-scroll-lock";

type DialogProps = {
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

export function Dialog({
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
  backdropLabel = "Close dialog",
  className,
  panelClassName,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const isTopmost = useTopmostOverlay(open);

  useBodyScrollLock(open && lockBodyScroll);
  useFocusTrap({
    active: open && trapFocus,
    containerRef: panelRef,
  });

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
      <OverlayBackdrop closeLabel={backdropLabel} onClick={closeOnBackdrop ? onClose : undefined} />
      <LayerManager layer="dialog">
        <div className={["fixed inset-0 flex items-center justify-center p-4 pointer-events-none", className || ""].filter(Boolean).join(" ")}>
          <FadeIn durationMs={180} distancePx={4} className="w-full max-w-full">
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={ariaLabel}
              aria-labelledby={resolvedTitleId}
              aria-describedby={resolvedDescriptionId}
              tabIndex={-1}
              className={[
                "pointer-events-auto mx-auto w-full rounded-[var(--radius-2xl)] border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-6 text-[var(--bos-text-primary)] shadow-[var(--shadow-large)]",
                panelClassName || "",
              ].filter(Boolean).join(" ")}
            >
              {title || description ? (
                <ModalHeader title={title} description={description} titleId={resolvedTitleId} descriptionId={resolvedDescriptionId} />
              ) : null}
              <div className={title || description ? "mt-5" : ""}>{children}</div>
              {footer ? <ModalFooter className="mt-5">{footer}</ModalFooter> : null}
            </div>
          </FadeIn>
        </div>
      </LayerManager>
    </PortalHost>
  );
}