import type { ComponentProps } from "react";
import clsx from "clsx";
import { Button as BaseButton } from "@base-ui/react/button";

type Variant = "solid" | "primary" | "ghost" | "subtle" | "none";

type Size = "sm" | "md" | "lg" | "icon";

const variantClass: Record<Variant, string | undefined> = {
  solid: "ui-btn",
  primary: "ui-btn ui-btn-primary",
  ghost: "ui-ghost",
  subtle: "ui-btn-subtle",
  none: undefined,
};

const sizeClass: Record<Size, string | undefined> = {
  sm: "ui-btn-sm",
  md: undefined,
  lg: "ui-btn-lg",
  icon: "ui-btn-icon",
};

export interface ButtonProps extends ComponentProps<typeof BaseButton> {
  /** Visual style; "none" keeps only caller classes (fully bespoke buttons). */
  variant?: Variant;
  /** Control size; "md" is the default look, "lg" is the emphasis size
      (max one per surface), "icon" is a square hit-target. */
  size?: Size;
}

/**
 * Base UI button with the app's shared control styles.
 * Wraps @base-ui/react/button — use this instead of raw <button> so
 * disabled/keyboard handling stays consistent app-wide.
 */
export function Button({ variant = "solid", size = "md", type = "button", className, ...props }: ButtonProps) {
  return <BaseButton type={type} className={clsx(variantClass[variant], sizeClass[size], className)} {...props} />;
}
