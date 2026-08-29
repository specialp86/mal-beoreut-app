"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRecordings } from "@/lib/history";
import { getHabitProfile, type ProfileHabit } from "@/lib/habitProfile";
import type { Recording } from "@/lib/types";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";
import { BarChart } from "@/components/BarChart";

export default function HistoryPage() {
  const [records, setRecords] = useState<Recording[]>([]);
  const [profile, setProfile] = useState<ProfileHabit[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecords(getRecordings());
    setProfile(getHabitProfile());
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
    value: r.totalHabitMentions ?? 0,
  }));

  const byDateDesc = records
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const profileCounts = Object.fromEntries(profile.map((h) => [h.expression, h.occurrences]));

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
          내가 가진 말하기 습관 (누적)
        </h2>
        {profile.length > 0 ? (
          <BarChart counts={profileCounts} />
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            아직 발견된 습관이 없습니다.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
          회차별 습관 언급 횟수 추이
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
                    습관 언급 {r.totalHabitMentions ?? 0}회
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
