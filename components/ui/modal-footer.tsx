import type { HTMLAttributes } from "react";

type ModalFooterProps = HTMLAttributes<HTMLDivElement>;

export function ModalFooter({ className, ...props }: ModalFooterProps) {
  return <div className={["flex flex-wrap justify-end gap-2.5", className || ""].filter(Boolean).join(" ")} {...props} />;
}