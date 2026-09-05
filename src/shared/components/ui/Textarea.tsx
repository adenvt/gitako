import type { ComponentProps } from "react";
import clsx from "clsx";

type Size = "sm" | "md" | "lg";

export interface TextareaProps extends Omit<ComponentProps<"textarea">, "size"> {
  /** Control size; "md" matches the .ui-textarea default. */
  size?: Size;
}

const sizeClass: Record<Size, string | undefined> = {
  sm: "ui-textarea-sm",
  md: undefined,
  lg: "ui-textarea-lg",
};

/**
 * Native textarea styled to match ui-input.
 * Base UI ships no textarea part; keeping it in the kit gives one import
 * surface and one style target for all multi-line fields.
 */
export function Textarea({ className, size = "md", ...props }: TextareaProps) {
  return (
    <textarea className={clsx("ui-textarea", sizeClass[size], className)} {...props} />
  );
}
