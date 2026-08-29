"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRecordings, getStatsSummary, type StatsSummary } from "@/lib/history";
import type { Recording } from "@/lib/types";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex-1 rounded-lg px-3 py-3 text-center"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
    </div>
  );
}

export default function HomePage() {
  const [recent, setRecent] = useState<Recording[]>([]);
  const [stats, setStats] = useState<StatsSummary | null>(null);

  useEffect(() => {
    // Reads from localStorage, which only exists on the client — this is
    // exactly the "external system" case set-state-in-effect exists for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(getRecordings().slice(0, 5));
    setStats(getStatsSummary());
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center gap-10 px-6 py-16 max-w-xl mx-auto w-full">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">음어탐지기</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          발표 리허설을 녹음하면 “음”, “어”, “그니까” 같은 습관어 사용 빈도를 분석해드려요.
        </p>
      </div>

      <Link
        href="/record"
        className="w-full max-w-xs text-center rounded-full py-4 text-lg font-semibold text-white shadow"
        style={{ background: "var(--series-1)" }}
      >
        녹음 시작
      </Link>

      {stats && stats.totalRecordings > 0 && (
        <section className="w-full grid grid-cols-2 gap-3">
          <StatTile label="누적 녹음" value={`${stats.totalRecordings}회`} />
          <StatTile label="평균 필러워드" value={`${stats.averageFillerCount}개`} />
          <StatTile label="최다 습관어" value={stats.topWord ? `${stats.topWord.word}` : "-"} />
          <StatTile
            label="평균 말하기 속도"
            value={stats.averageSyllablesPerMinute ? `${stats.averageSyllablesPerMinute}음절/분` : "-"}
          />
        </section>
      )}

      <section className="w-full">
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
          최근 녹음
        </h2>
        {recent.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            아직 녹음 기록이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/result?id=${r.id}`}
                  className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <span className="text-sm">
                    {new Date(r.createdAt).toLocaleString("ko-KR", {
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
        {recent.length > 0 && (
          <Link
            href="/history"
            className="mt-3 inline-block text-sm underline"
            style={{ color: "var(--text-secondary)" }}
          >
            히스토리 전체 보기
          </Link>
        )}
      </section>
    </main>
  );
}
