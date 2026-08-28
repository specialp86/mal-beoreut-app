"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRecordings } from "@/lib/history";
import type { Recording } from "@/lib/types";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";

export default function HistoryPage() {
  const [records, setRecords] = useState<Recording[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecords(getRecordings());
  }, []);

  const chronological = records
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const trendPoints: TrendPoint[] = chronological.map((r) => ({
    id: r.id,
    label: new Date(r.createdAt).toLocaleDateString("ko-KR", {
      month: "numeric",
      day: "numeric",
    }),
    value: r.totalFillerCount,
  }));

  const byDateDesc = records
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <main className="flex-1 flex flex-col gap-8 px-6 py-12 max-w-xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">히스토리</h1>
        <Link href="/" className="text-sm underline" style={{ color: "var(--text-secondary)" }}>
          홈으로
        </Link>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
          회차별 필러워드 총 개수 추이
        </h2>
        <TrendChart points={trendPoints} />
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
          날짜별 기록
        </h2>
        {byDateDesc.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            아직 녹음 기록이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {byDateDesc.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/result?id=${r.id}`}
                  className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <span className="text-sm">
                    {new Date(r.createdAt).toLocaleString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span
                    className="text-xs font-semibold rounded-full px-2.5 py-1 text-white"
                    style={{ background: "var(--series-1)" }}
                  >
                    필러워드 {r.totalFillerCount}개
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
