import { BRAND_COLOR } from "@/lib/style";

// Rounded-square mark with a pulse/heartbeat line — the app icon style
// concept the user picked from the logo review (see SPEC.md). Self-contained
// fill color, so it reads fine on both light and dark backgrounds without
// needing a dark-mode variant, same as app/icon.svg (keep the two in sync if
// this ever changes — the favicon is a static file and can't import this).
export default function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Taiwan Pulse"
    >
      <rect x="6" y="6" width="88" height="88" rx="22" fill={BRAND_COLOR} />
      <polyline
        points="18,52 34,52 40,36 48,66 56,30 64,52 82,52"
        fill="none"
        stroke="#ffffff"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
