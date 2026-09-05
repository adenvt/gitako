import { Spinner } from "./Spinner";

type IconSize = 12 | 13 | 16;

const SIZE_MAP: Record<"sm" | "md" | "lg", IconSize> = {
  sm: 12,
  md: 13,
  lg: 16,
};

/** Loading spinner (delegates to the shared Spinner). */
export function InputSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return <Spinner size={size} />;
}

/** Check icon, green, for state="success". */
export function InputCheck({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const px = SIZE_MAP[size];
  return (
    <svg
      className="ui-input-icon ui-input-icon-ok"
      width={px}
      height={px}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M3.5 8.5l3 3 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Alert/circle-with-! icon, red, for state="invalid". */
export function InputAlert({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const px = SIZE_MAP[size];
  return (
    <svg
      className="ui-input-icon ui-input-icon-err"
      width={px}
      height={px}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 5v3.5M8 11.25v.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Small × icon used by the clearable button. */
export function InputClear({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const px = SIZE_MAP[size];
  return (
    <svg
      className="ui-input-icon"
      width={px}
      height={px}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M4.5 4.5l7 7M11.5 4.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
