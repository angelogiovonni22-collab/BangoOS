import { Children, isValidElement, type LabelHTMLAttributes, type ReactNode } from "react";

type FormLabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  required?: boolean;
  disabled?: boolean;
};

export function getFormLabelClassName(disabled = false) {
  return [
    "text-label block",
    disabled ? "text-[var(--bos-text-medium-on-light)]" : "text-[var(--bos-text-strong-on-light)]",
  ].join(" ");
}

export function FormLabel({ children, className, required = false, disabled = false, ...props }: FormLabelProps) {
  const composedClassName = [getFormLabelClassName(disabled), className || ""]
    .filter(Boolean)
    .join(" ");

  return (
    <label className={composedClassName} {...props}>
      {children}
      {required ? <span className="ml-1 text-[var(--color-danger-700)]">*</span> : null}
    </label>
  );
}

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  error?: string;
  children: ReactNode;
};

function inferDisabledFromChildren(children: ReactNode) {
  return Children.toArray(children).some((child) => {
    if (!isValidElement(child) || !child.props || typeof child.props !== "object") {
      return false;
    }

    return "disabled" in child.props && Boolean((child.props as { disabled?: boolean }).disabled);
  });
}

export function FormField({
  label,
  htmlFor,
  required = false,
  disabled,
  className,
  labelClassName,
  error,
  children,
}: FormFieldProps) {
  const isDisabled = disabled ?? inferDisabledFromChildren(children);
  const composedClassName = ["space-y-[var(--space-form-gap)]", className || ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={composedClassName}>
      <FormLabel htmlFor={htmlFor} required={required} disabled={isDisabled} className={labelClassName}>
        {label}
      </FormLabel>
      {children}
      {error ? <p className="text-metadata text-[var(--color-danger-700)]">{error}</p> : null}
    </div>
  );
}