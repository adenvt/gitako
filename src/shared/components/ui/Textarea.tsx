import type { ComponentProps } from "react";
import clsx from "clsx";

export type TextareaProps = ComponentProps<"textarea">;

/**
 * Native textarea styled to match ui-input.
 * Base UI ships no textarea part; keeping it in the kit gives one import
 * surface and one style target for all multi-line fields.
 */
export function Textarea({ className, ...props }: TextareaProps) {
  return <textarea className={clsx("ui-textarea", className)} {...props} />;
}
