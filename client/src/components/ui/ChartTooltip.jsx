/**
 * Recharts tooltip styled with the app theme tokens. The default Recharts
 * tooltip uses hard-coded colors (black item text), unreadable in dark mode.
 * Usage: <Tooltip content={<ChartTooltip />} />
 */
export default function ChartTooltip({ active, payload, label, hideLabel }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((item) => item.value !== null && item.value !== undefined);
  if (!items.length) return null;

  return (
    <div className="min-w-[8rem] rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink shadow-pop">
      {!hideLabel && label !== undefined && <p className="mb-1.5 font-bold">{label}</p>}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.dataKey ?? item.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.payload?.color ?? item.color ?? item.fill }} />
            <span className="text-muted">{item.name}</span>
            <span className="ml-auto pl-3 font-bold">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
