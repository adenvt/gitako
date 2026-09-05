import type { ComponentProps } from "react";
import clsx from "clsx";
import { InputClear } from "./InputIcons";

type Size = "sm" | "md" | "lg";

export interface TextareaProps
  extends Omit<ComponentProps<"textarea">, "size" | "onChange"> {
  /** Control size; "md" matches the .ui-textarea default. */
  size?: Size;
  /** Invalid state (red border + aria-invalid). loading/success don't render visually. */
  state?: "invalid";
  /** When true and the value is non-empty, shows a × button top-right. */
  clearable?: boolean;
  /** onChange receives the synthetic change event. */
  onChange?: (event: { target: { value: string } }) => void;
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
export function Textarea({
  className,
  size = "md",
  state,
  clearable = false,
  value,
  onChange,
  disabled,
  ...props
}: TextareaProps) {
  const hasValue = value != null && String(value) !== "";
  const showClear = clearable && !disabled && hasValue;

  function handleClear() {
    onChange?.({ target: { value: "" } });
  }

  const textarea = (
    <textarea
      aria-invalid={state === "invalid" || undefined}
      className={clsx(
        "ui-textarea",
        sizeClass[size],
        state === "invalid" && "ui-textarea-invalid",
        className,
      )}
      value={value}
      onChange={onChange as never}
      disabled={disabled}
      {...props}
    />
  );

  if (!showClear) return textarea;

  return (
    <span className="ui-textarea-shell">
      {textarea}
      <button
        type="button"
        className="ui-textarea-clear"
        aria-label="Clear input"
        onClick={handleClear}
        tabIndex={-1}
      >
        <InputClear size={size} />
      </button>
    </span>
  );
}
