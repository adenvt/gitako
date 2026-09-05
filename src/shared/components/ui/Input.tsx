import type { ComponentProps, ReactNode } from "react";
import clsx from "clsx";
import { Input as BaseInput } from "@base-ui/react/input";
import { InputSpinner, InputCheck, InputAlert, InputClear } from "./InputIcons";
type Size = "sm" | "md" | "lg";
type State = "loading" | "success" | "invalid";

export interface InputProps
  extends Omit<ComponentProps<typeof BaseInput>, "size" | "prefix" | "onChange"> {
  /** Control size; "md" matches the .ui-input default. */
  size?: Size;
  /**
   * Visual state. Mutually exclusive: `loading` disables the input and
   * renders a trailing spinner; `success` shows a green check; `invalid`
   * shows a red alert icon and a red border (sets aria-invalid="true").
   */
  state?: State;
  /** Content rendered before the input inside the shell. */
  prepend?: ReactNode;
  /** Content rendered after the input inside the shell (before the state icon / clear). */
  append?: ReactNode;
  /** When true and the value is non-empty (and not loading/disabled), shows a × button. */
  clearable?: boolean;
  /** onChange receives the base UI event wrapper; the inner event has the .target.value. */
  onChange?: (event: { target: { value: string } }) => void;
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
export function Input({
  className,
  size = "md",
  state,
  prepend,
  append,
  clearable = false,
  value,
  onChange,
  disabled,
  ...props
}: InputProps) {
  const isLoading = state === "loading";
  const hasValue = value != null && String(value) !== "";
  const showClear =
    clearable && !isLoading && !disabled && hasValue;

  function handleClear() {
    onChange?.({ target: { value: "" } });
  }

  const hasShell = !!(state || prepend || append || showClear);

  const input = (
    <BaseInput
      aria-invalid={state === "invalid" || undefined}
      disabled={isLoading || disabled}
      aria-busy={isLoading || undefined}
      className={clsx(
        "ui-input",
        hasShell && "ui-input-flat",
        sizeClass[size],
        state && stateClass[state],
        className,
      )}
      value={value}
      onChange={onChange as never}
      {...props}
    />
  );

  if (!hasShell) return input;

  return (
    <span
      className={clsx(
        "ui-input-shell",
        sizeClass[size],
        state && stateClass[state],
      )}
    >
      {prepend && <span className="ui-input-affix ui-input-affix-prepend">{prepend}</span>}
      {input}
      {append && <span className="ui-input-affix ui-input-affix-append">{append}</span>}
      {state && <span className="ui-input-affix ui-input-affix-state">{stateIcon[state]}</span>}
      {showClear && (
        <button
          type="button"
          className="ui-input-clear"
          aria-label="Clear input"
          onClick={handleClear}
          tabIndex={-1}
        >
          <InputClear size={size} />
        </button>
      )}
    </span>
  );
}
