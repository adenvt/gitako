import type { ComponentProps } from "react";
import clsx from "clsx";
import { Input as BaseInput } from "@base-ui/react/input";

export type InputProps = ComponentProps<typeof BaseInput>;

/**
 * Base UI input (native <input>) with the app's shared field styles.
 * Wraps @base-ui/react/input — use this instead of raw <input>.
 */
export function Input({ className, ...props }: InputProps) {
  return <BaseInput className={clsx("ui-input", className)} {...props} />;
}
