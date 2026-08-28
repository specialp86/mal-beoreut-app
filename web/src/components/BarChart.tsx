import type { FillerCounts } from "@/lib/filler-words";

interface BarChartProps {
  counts: FillerCounts;
}

export function BarChart({ counts }: BarChartProps) {
  const rows = Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (rows.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        검출된 필러워드가 없습니다.
      </p>
    );
  }

  const max = rows[0][1];

  return (
    <div className="flex flex-col gap-3" role="img" aria-label="단어별 필러워드 빈도">
      {rows.map(([word, count], i) => (
        <div key={word} className="flex items-center gap-3">
          <span
            className={`w-20 shrink-0 text-sm text-right ${i === 0 ? "font-semibold" : ""}`}
            style={{ color: "var(--foreground)" }}
          >
            {word}
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
