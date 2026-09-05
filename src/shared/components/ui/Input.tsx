import type { ComponentProps, ReactNode } from "react";
import clsx from "clsx";
import { Input as BaseInput } from "@base-ui/react/input";
import { InputSpinner, InputCheck, InputAlert } from "./InputIcons";

type Size = "sm" | "md" | "lg";
type State = "loading" | "success" | "invalid";

export interface InputProps extends Omit<ComponentProps<typeof BaseInput>, "size"> {
  /** Control size; "md" matches the .ui-input default. */
  size?: Size;
  /**
   * Visual state. Mutually exclusive: `loading` disables the input and
   * renders a trailing spinner; `success` shows a green check; `invalid`
   * shows a red alert icon and a red border (sets aria-invalid="true").
   */
  state?: State;
}

const sizeClass: Record<Size, string | undefined> = {
  sm: "ui-input-sm",
  md: undefined,
  lg: "ui-input-lg",
};

const stateClass: Record<State, string | undefined> = {
  loading: undefined,
  success: undefined,
  invalid: "ui-input-invalid",
};

const stateIcon: Record<State, ReactNode> = {
  loading: <InputSpinner />,
  success: <InputCheck />,
  invalid: <InputAlert />,
};

/**
 * Base UI input (native <input>) with the app's shared field styles.
 * Wraps @base-ui/react/input — use this instead of raw <input>.
 */
export function Input({ className, size = "md", state, ...props }: InputProps) {
  const isLoading = state === "loading";
  const input = (
    <BaseInput
      aria-invalid={state === "invalid" || undefined}
      disabled={isLoading || props.disabled}
      aria-busy={isLoading || undefined}
      className={clsx(
        "ui-input",
        state && "ui-input-flat",
        sizeClass[size],
        state && stateClass[state],
        className,
      )}
      {...props}
    />
  );

  if (!state) return input;

  return (
    <span
      className={clsx(
        "ui-input-shell",
        sizeClass[size],
        stateClass[state],
      )}
    >
      {input}
      <span className="ui-input-affix ui-input-affix-state">{stateIcon[state]}</span>
    </span>
  );
}
