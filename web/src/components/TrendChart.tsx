"use client";

import { useState } from "react";

export interface TrendPoint {
  id: string;
  label: string;
  value: number;
}

interface TrendChartProps {
  points: TrendPoint[];
}

const WIDTH = 640;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 32 };

export function TrendChart({ points }: TrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        아직 녹음 기록이 없습니다.
      </p>
    );
  }

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const maxValue = Math.max(...points.map((p) => p.value), 1);
  const yTicks = 4;

  const x = (i: number) =>
    points.length === 1
      ? PADDING.left + plotWidth / 2
      : PADDING.left + (i / (points.length - 1)) * plotWidth;
  const y = (v: number) => PADDING.top + plotHeight - (v / maxValue) * plotHeight;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.value)}`)
    .join(" ");
  const areaPath =
    `${linePath} L ${x(points.length - 1)} ${PADDING.top + plotHeight} ` +
    `L ${x(0)} ${PADDING.top + plotHeight} Z`;

  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="relative" role="img" aria-label="회차별 필러워드 총 개수 추이">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const value = Math.round((maxValue / yTicks) * i);
          const gy = y(value);
          return (
            <g key={i}>
              <line
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={gy}
                y2={gy}
                stroke="var(--gridline)"
                strokeWidth={1}
              />
              <text x={4} y={gy + 4} fontSize={10} fill="var(--text-muted)">
                {value}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="var(--series-1)" opacity={0.1} />
        <path
          d={linePath}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <g key={p.id}>
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={6}
              fill="var(--surface)"
            />
            <circle
              cx={x(i)}
              cy={y(p.value)}
              r={4}
              fill="var(--series-1)"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
              style={{ cursor: "pointer" }}
            />
            <text
              x={x(i)}
              y={HEIGHT - 8}
              fontSize={10}
              textAnchor="middle"
              fill="var(--text-muted)"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>

      {hovered && (
        <div
          className="absolute pointer-events-none rounded-md px-2 py-1 text-xs shadow"
          style={{
            left: `${(x(hoverIndex!) / WIDTH) * 100}%`,
            top: 0,
            transform: "translate(-50%, -100%)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--foreground)",
          }}
        >
          {hovered.label}: {hovered.value}개
        </div>
      )}
    </div>
  );
}
