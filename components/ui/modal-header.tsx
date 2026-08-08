import type { HTMLAttributes, ReactNode } from "react";

type ModalHeaderProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title?: ReactNode;
  description?: ReactNode;
  titleId?: string;
  descriptionId?: string;
  action?: ReactNode;
};

export function ModalHeader({
  title,
  description,
  titleId,
  descriptionId,
  action,
  className,
  children,
  ...props
}: ModalHeaderProps) {
  return (
    <div className={["flex items-start justify-between gap-3", className || ""].filter(Boolean).join(" ")} {...props}>
      <div className="min-w-0 flex-1">
        {title ? <h2 id={titleId} className="text-h3 font-bold leading-[1.3] tracking-[-0.01em] text-[var(--bos-text-strong-on-light)]">{title}</h2> : null}
        {description ? <p id={descriptionId} className="mt-1.5 text-body-secondary font-medium text-[var(--bos-text-medium-on-light)]">{description}</p> : null}
        {children}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}