export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string | null;
}) {
  return (
    <div className="card p-6">
      <p className="eyebrow">{label}</p>
      <p className="mt-4 text-3xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-2 text-xs text-[var(--color-muted-2)]">{hint}</p>}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  const tones = {
    neutral: "border-[var(--color-line-strong)] text-[var(--color-muted)]",
    positive: "border-emerald-500/40 text-emerald-300",
    warning: "border-amber-500/40 text-amber-300",
    danger: "border-red-500/40 text-red-300",
  } as const;

  return (
    <span
      className={`inline-block border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-10 text-center">
      <p className="text-lg font-bold">{title}</p>
      <p className="mx-auto mt-3 max-w-md text-sm text-[var(--color-muted)]">{body}</p>
    </div>
  );
}
