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

type DrawerProps = {
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
  showBackdrop?: boolean;
  lockBodyScroll?: boolean;
  trapFocus?: boolean;
  backdropLabel?: string;
  className?: string;
  panelClassName?: string;
};

export function Drawer({
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
  showBackdrop = true,
  lockBodyScroll = true,
  trapFocus = true,
  backdropLabel = "Close drawer",
  className,
  panelClassName,
}: DrawerProps) {
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
      {showBackdrop ? <OverlayBackdrop closeLabel={backdropLabel} onClick={closeOnBackdrop ? onClose : undefined} /> : null}
      <LayerManager layer="dialog">
        <div className={["fixed inset-y-0 right-0 flex max-w-full items-stretch justify-end pointer-events-none", className || ""].filter(Boolean).join(" ")}>
          <SlidePanel
            ref={panelRef}
            open={open}
            from="right"
            trapFocus={trapFocus}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            aria-labelledby={resolvedTitleId}
            aria-describedby={resolvedDescriptionId}
            className={[
              "pointer-events-auto h-full w-full max-w-[min(32rem,100vw)] overflow-y-auto border-l border-[var(--bos-border-light)] bg-white bg-[var(--bos-bg-workspace-card)] p-5 shadow-[var(--shadow-large)]",
              panelClassName || "",
            ].filter(Boolean).join(" ")}
          >
            {title || description ? (
              <ModalHeader title={title} description={description} titleId={resolvedTitleId} descriptionId={resolvedDescriptionId} />
            ) : null}
            <div className={title || description ? "mt-5" : ""}>{children}</div>
            {footer ? <ModalFooter className="mt-5">{footer}</ModalFooter> : null}
          </SlidePanel>
        </div>
      </LayerManager>
    </PortalHost>
  );
}