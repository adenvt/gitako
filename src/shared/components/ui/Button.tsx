import type { ComponentProps } from "react";
import clsx from "clsx";
import { Button as BaseButton } from "@base-ui/react/button";

type Variant = "solid" | "primary" | "ghost" | "none";

const variantClass: Record<Variant, string | undefined> = {
  solid: "ui-btn",
  primary: "ui-btn ui-btn-primary",
  ghost: "ui-ghost",
  none: undefined,
};

export interface ButtonProps extends ComponentProps<typeof BaseButton> {
  /** Visual style; "none" keeps only caller classes (fully bespoke buttons). */
  variant?: Variant;
}

/**
 * Base UI button with the app's shared control styles.
 * Wraps @base-ui/react/button — use this instead of raw <button> so
 * disabled/keyboard handling stays consistent app-wide.
 */
export function Button({ variant = "solid", type = "button", className, ...props }: ButtonProps) {
  return <BaseButton type={type} className={clsx(variantClass[variant], className)} {...props} />;
}
