interface ConfidenceBadgeProps {
  confidence: number; // 0.0 – 1.0
  showPercent?: boolean;
}

export function ConfidenceBadge({ confidence, showPercent = true }: ConfidenceBadgeProps) {
  const pct = Math.round(confidence * 100);

  const color =
    pct >= 80
      ? "bg-green-50 text-green-700 border-green-200"
      : pct >= 50
      ? "bg-yellow-50 text-yellow-700 border-yellow-200"
      : "bg-red-50 text-red-700 border-red-200";

  const label = pct >= 80 ? "High" : pct >= 50 ? "Medium" : "Low";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {showPercent ? `${pct}%` : label}
    </span>
  );
}
