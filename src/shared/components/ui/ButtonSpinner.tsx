/**
 * Tiny inline-SVG spinner used by the Button kit when `loading` is true.
 * Scales with button size: sm=12, md=13, lg=16, icon=12.
 */
type SpinnerSize = 12 | 13 | 16;

const SIZE_MAP: Record<"sm" | "md" | "lg" | "icon", SpinnerSize> = {
  sm: 12,
  md: 13,
  lg: 16,
  icon: 12,
};

export function ButtonSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" | "icon" }) {
  const px = SIZE_MAP[size];
  return (
    <svg
      className="ui-btn-spinner"
      width={px}
      height={px}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.25"
      />
      <path
        d="M14 8a6 6 0 0 0-6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
