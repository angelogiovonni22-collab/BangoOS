import { Children, cloneElement, isValidElement, useId, type LabelHTMLAttributes, type ReactElement, type ReactNode } from "react";

type FormLabelProps = LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean; disabled?: boolean };

export function getFormLabelClassName(disabled = false) {
  return ["text-label block font-semibold", disabled ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"].join(" ");
}

export function FormLabel({ children, className, required = false, disabled = false, ...props }: FormLabelProps) {
  const composedClassName = [getFormLabelClassName(disabled), className || ""].filter(Boolean).join(" ");
  return <label className={composedClassName} {...props}>{children}{required ? <span className="ml-1 text-[var(--color-danger-700)]">*</span> : null}</label>;
}

type FormFieldProps = { label: string; htmlFor?: string; required?: boolean; disabled?: boolean; className?: string; labelClassName?: string; error?: string; children: ReactNode };

function inferDisabledFromChildren(children: ReactNode) {
  return Children.toArray(children).some((child) => {
    if (!isValidElement(child) || !child.props || typeof child.props !== "object") return false;
    return "disabled" in child.props && Boolean((child.props as { disabled?: boolean }).disabled);
  });
}

export function FormField({ label, htmlFor, required = false, disabled, className, labelClassName, error, children }: FormFieldProps) {
  const generatedId = useId();
  const isDisabled = disabled ?? inferDisabledFromChildren(children);
  const composedClassName = ["space-y-[var(--space-form-gap)]", className || ""].filter(Boolean).join(" ");
  const onlyChild = Children.count(children) === 1 && isValidElement(children) ? children as ReactElement<Record<string, unknown>> : null;
  const childType = onlyChild?.type;
  const canAssociate = Boolean(onlyChild && childType !== "label" && childType !== "fieldset");
  const controlId = htmlFor || (typeof onlyChild?.props.id === "string" ? onlyChild.props.id : canAssociate ? generatedId : undefined);
  const errorId = error && controlId ? `${controlId}-error` : undefined;
  const describedBy = onlyChild && typeof onlyChild.props["aria-describedby"] === "string" ? onlyChild.props["aria-describedby"] : undefined;
  const associatedChildren = canAssociate && onlyChild && controlId
    ? cloneElement(onlyChild, {
        id: controlId,
        ...(error ? { "aria-invalid": true, "aria-describedby": [describedBy, errorId].filter(Boolean).join(" ") } : {}),
      })
    : children;
  return (
    <div className={composedClassName}>
      <FormLabel htmlFor={controlId} required={required} disabled={isDisabled} className={labelClassName}>{label}</FormLabel>
      {associatedChildren}
      {error ? <p id={errorId} className="text-metadata text-[var(--color-danger-700)]">{error}</p> : null}
    </div>
  );
}
