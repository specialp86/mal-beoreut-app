interface BarChartProps {
  counts: Record<string, number>;
  emptyMessage?: string;
}

export function BarChart({ counts, emptyMessage = "표시할 항목이 없습니다." }: BarChartProps) {
  const rows = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {emptyMessage}
      </p>
    );
  }

  const max = rows[0][1];

  return (
    <div className="flex flex-col gap-3" role="img" aria-label="항목별 빈도">
      {rows.map(([label, count], i) => (
        <div key={label} className="flex items-center gap-3">
          <span
            className={`w-28 shrink-0 text-sm text-right ${i === 0 ? "font-semibold" : ""}`}
            style={{ color: "var(--foreground)" }}
          >
            {label}
            {i === 0 && (
              <span className="ml-1 text-xs" style={{ color: "var(--text-muted)" }}>
                최다
              </span>
            )}
          </span>
          <div className="flex-1 flex items-center gap-2">
            <div
              className="h-5 rounded-[4px]"
              style={{
                width: `${Math.max((count / max) * 100, 4)}%`,
                background: "var(--series-1)",
              }}
            />
            <span className="text-sm tabular-nums" style={{ color: "var(--text-secondary)" }}>
              {count}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
