const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  not_started:   { label: "Not Started",   className: "bg-slate-100 text-slate-500" },
  in_progress:   { label: "In Progress",   className: "bg-blue-50 text-blue-700" },
  ai_processing: { label: "AI Processing", className: "bg-purple-50 text-purple-700" },
  needs_review:  { label: "Needs Review",  className: "bg-yellow-50 text-yellow-700" },
  note_finalized:{ label: "Note Finalized",className: "bg-teal-50 text-teal-700" },
  finalized:     { label: "Finalized",     className: "bg-green-50 text-green-700" },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-slate-100 text-slate-500" };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
