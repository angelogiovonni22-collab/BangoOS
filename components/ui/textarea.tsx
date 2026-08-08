import { forwardRef, type TextareaHTMLAttributes } from "react";
import { getControlClassName } from "./input";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function getTextareaClassName(invalid = false) {
  return [
    getControlClassName({ invalid }),
    "min-h-24 h-auto py-2.5 resize-y",
  ].join(" ");
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, ...props }, ref) {
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
  const composedClassName = [getTextareaClassName(invalid), className || ""]
    .filter(Boolean)
    .join(" ");

  return <textarea ref={ref} className={composedClassName} {...props} />;
});