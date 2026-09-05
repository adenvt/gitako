/**
 * Shared loading spinner used by Button, Input (loading state), and any
 * other control that needs a busy indicator.
 *
 * Inline SVG; currentColor so it inherits the surrounding text color.
 * 800ms spin, slowed to 3s under prefers-reduced-motion. The class is
 * `ui-spinner` (shared by all consumers — do not prefix with `ui-btn-`).
 */
type SpinnerSize = 12 | 13 | 16;

const SIZE_MAP: Record<"sm" | "md" | "lg", SpinnerSize> = {
  sm: 12,
  md: 13,
  lg: 16,
};

export function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const px = SIZE_MAP[size];
  return (
    <svg
      className="ui-spinner"
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
