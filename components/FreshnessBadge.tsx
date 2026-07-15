import { PulseEvent } from "@/lib/types";
import { computeFreshness } from "@/lib/freshness";
import { formatClock } from "@/lib/time";
import { SEVERITY_COLORS } from "@/lib/style";

export default function FreshnessBadge({ event }: { event: PulseEvent }) {
  const freshness = computeFreshness(event);
  const validUntilText = event.validUntil ? `有效至 ${formatClock(event.validUntil)}` : undefined;

  if (freshness.level === "expired") {
    return (
      <Badge color={SEVERITY_COLORS.critical} icon="⛔">
        已過期{validUntilText ? `（${validUntilText}）` : ""}
      </Badge>
    );
  }
  if (freshness.level === "expiring") {
    return (
      <Badge color={SEVERITY_COLORS.warning} icon="⏳">
        即將到期{validUntilText ? `（${validUntilText}）` : ""}
      </Badge>
    );
  }
  if (freshness.level === "stale") {
    return (
      <Badge color={SEVERITY_COLORS.warning} icon="🕓">
        {freshness.label}
      </Badge>
    );
  }
  if (validUntilText) {
    // current + has an explicit validity window — informational, not alarming
    return (
      <span className="text-xs text-ink-muted" title="官方標示的有效期限">
        {validUntilText}
      </span>
    );
  }
  return null;
}

function Badge({
  color,
  icon,
  children,
}: {
  color: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  );
}
