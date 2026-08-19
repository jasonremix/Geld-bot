export function Marquee({ items }: { items: readonly string[] }) {
  const loop = [...items, ...items];
  return (
    <div className="overflow-hidden border-y border-[var(--color-line)] py-5">
      <div className="marquee-track" aria-hidden="true">
        {loop.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="flex items-center gap-8 whitespace-nowrap px-8 text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-muted-2)]"
          >
            {item}
            <span className="h-1 w-1 rounded-full bg-[var(--color-line-strong)]" />
          </span>
        ))}
      </div>
      <span className="sr-only">{items.join(", ")}</span>
    </div>
  );
}
