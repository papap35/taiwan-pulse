import { Severity, SEVERITY_LABELS } from "@/lib/types";
import { SEVERITY_COLORS, SEVERITY_ICON } from "@/lib/style";

export default function SeverityBadge({ severity }: { severity: Severity }) {
  const color = SEVERITY_COLORS[severity];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <span aria-hidden>{SEVERITY_ICON[severity]}</span>
      {SEVERITY_LABELS[severity]}
    </span>
  );
}
