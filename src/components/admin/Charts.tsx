import { formatMoney } from "@/lib/money";

/**
 * Charts als reines SVG – keine Chart-Bibliothek.
 * Das hält das Bundle klein und funktioniert ohne Client-JavaScript.
 */

export type Point = { date: string; cents: number; orders: number };

export function RevenueBars({ points, currency = "EUR" }: { points: Point[]; currency?: string }) {
  const max = Math.max(1, ...points.map((p) => p.cents));
  const total = points.reduce((sum, p) => sum + p.cents, 0);

  return (
    <div className="card p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="eyebrow">Umsatz je Tag</p>
        <p className="text-sm text-[var(--color-muted)]">
          Summe: <span className="text-white">{formatMoney(total, currency)}</span>
        </p>
      </div>

      {total === 0 && (
        <p className="mt-8 border border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-muted)]">
          Für diesen Zeitraum liegen keine bestätigten Zahlungen vor.
        </p>
      )}

      <div
        className={`mt-8 flex h-48 items-end gap-[3px] ${total === 0 ? "opacity-40" : ""}`}
        role="img"
        aria-label="Balkendiagramm Tagesumsatz"
      >
        {points.map((point) => {
          const height = point.cents === 0 ? 2 : Math.max(4, Math.round((point.cents / max) * 100));
          return (
            <div key={point.date} className="group relative flex-1">
              <div
                className="w-full bg-[var(--color-line-strong)] transition-colors duration-300 group-hover:bg-white"
                style={{ height: `${height}%` }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap border border-[var(--color-line-strong)] bg-black px-2 py-1 text-[10px] group-hover:block">
                {point.date} · {formatMoney(point.cents, currency)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex justify-between text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted-2)]">
        <span>{points[0]?.date ?? "—"}</span>
        <span>{points[points.length - 1]?.date ?? "—"}</span>
      </div>
    </div>
  );
}

export function Sparkline({ points }: { points: Point[] }) {
  if (points.length === 0) return null;

  const max = Math.max(1, ...points.map((p) => p.cents));
  const width = 100;
  const height = 28;
  const step = points.length > 1 ? width / (points.length - 1) : width;

  const path = points
    .map((point, index) => {
      const x = index * step;
      const y = height - (point.cents / max) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-full" preserveAspectRatio="none" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function RankedBars({
  items,
  formatValue,
}: {
  items: { label: string; sublabel?: string; value: number }[];
  formatValue: (value: number) => string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));

  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">Noch keine Daten vorhanden.</p>;
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={`${item.label}-${item.sublabel ?? ""}`}>
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="whitespace-nowrap text-[var(--color-muted)]">
              {formatValue(item.value)}
            </span>
          </div>
          {item.sublabel && (
            <p className="mt-1 truncate text-xs text-[var(--color-muted-2)]">{item.sublabel}</p>
          )}
          <div className="mt-2 h-1 bg-[var(--color-line)]">
            <div className="h-full bg-white" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
