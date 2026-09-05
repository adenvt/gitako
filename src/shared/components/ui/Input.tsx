import type { ComponentProps } from "react";
import clsx from "clsx";
import { Input as BaseInput } from "@base-ui/react/input";

type Size = "sm" | "md" | "lg";

export interface InputProps extends Omit<ComponentProps<typeof BaseInput>, "size"> {
  /** Control size; "md" matches the .ui-input default. */
  size?: Size;
}

const sizeClass: Record<Size, string | undefined> = {
  sm: "ui-input-sm",
  md: undefined,
  lg: "ui-input-lg",
};

/**
 * Base UI input (native <input>) with the app's shared field styles.
 * Wraps @base-ui/react/input — use this instead of raw <input>.
 */
export function Input({ className, size = "md", ...props }: InputProps) {
  return <BaseInput className={clsx("ui-input", sizeClass[size], className)} {...props} />;
}
