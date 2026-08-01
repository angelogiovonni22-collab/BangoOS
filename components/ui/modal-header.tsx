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
        {title ? <h2 id={titleId} className="text-h3 text-[var(--color-text-primary)]">{title}</h2> : null}
        {description ? <p id={descriptionId} className="mt-1 text-body-secondary text-[var(--color-text-secondary)]">{description}</p> : null}
        {children}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}