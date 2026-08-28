"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { getPreviousRecording, getRecording } from "@/lib/history";
import type { Recording } from "@/lib/types";
import { BarChart } from "@/components/BarChart";

function ComparisonNote({ current, previous }: { current: Recording; previous?: Recording }) {
  if (!previous) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        아직 비교할 이전 녹음이 없습니다.
      </p>
    );
  }
  if (previous.totalFillerCount === 0) {
    return null;
  }
  const diff = previous.totalFillerCount - current.totalFillerCount;
  const percent = Math.round((Math.abs(diff) / previous.totalFillerCount) * 100);
  const improved = diff > 0;
  const unchanged = diff === 0;

  return (
    <p
      className="text-sm font-medium"
      style={{ color: unchanged ? "var(--text-secondary)" : improved ? "var(--good)" : "var(--serious)" }}
    >
      {unchanged
        ? "지난번과 필러워드 개수가 같아요."
        : improved
          ? `지난번보다 ${percent}% 줄었어요 👍`
          : `지난번보다 ${percent}% 늘었어요`}
    </p>
  );
}

function ResultContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [recording, setRecording] = useState<Recording | null | undefined>(undefined);
  const [previous, setPrevious] = useState<Recording | undefined>(undefined);

  useEffect(() => {
    if (!id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecording(null);
      return;
    }
    setRecording(getRecording(id) ?? null);
    setPrevious(getPreviousRecording(id));
  }, [id]);

  if (recording === undefined) return null;

  if (recording === null) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 py-16">
        <p style={{ color: "var(--text-secondary)" }}>녹음 기록을 찾을 수 없습니다.</p>
        <Link href="/" className="underline text-sm">
          홈으로
        </Link>
      </main>
    );
  }

  const minutes = Math.max(recording.durationSeconds / 60, 1 / 60);
  const perMinute = Math.round((recording.totalFillerCount / minutes) * 10) / 10;

  return (
    <main className="flex-1 flex flex-col gap-8 px-6 py-12 max-w-xl mx-auto w-full">
      <section className="text-center">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          전체 필러워드 개수
        </p>
        <p className="text-5xl font-semibold mt-1">{recording.totalFillerCount}개</p>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          분당 {perMinute}개
        </p>
        <div className="mt-3">
          <ComparisonNote current={recording} previous={previous} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
          단어별 빈도
        </h2>
        <BarChart counts={recording.fillerCounts} />
      </section>

      <section className="flex gap-3 justify-center">
        <Link
          href="/record"
          className="rounded-full px-6 py-3 text-sm font-semibold text-white"
          style={{ background: "var(--series-1)" }}
        >
          다시 녹음
        </Link>
        <Link
          href="/history"
          className="rounded-full px-6 py-3 text-sm font-semibold"
          style={{ border: "1px solid var(--border)" }}
        >
          히스토리 보기
        </Link>
      </section>
    </main>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultContent />
    </Suspense>
  );
}
