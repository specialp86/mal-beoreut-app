import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Recording } from "@/lib/types";
import { BarChart } from "@/components/BarChart";
import { AudioPlayback } from "@/components/AudioPlayback";
import { speedLabel } from "@/lib/speed";

function ComparisonNote({ current, previous }: { current: Recording; previous: Recording | null }) {
  if (!previous) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        아직 비교할 이전 녹음이 없습니다.
      </p>
    );
  }
  const prevTotal = previous.total_habit_mentions ?? 0;
  if (prevTotal === 0) return null;

  const diff = prevTotal - current.total_habit_mentions;
  const percent = Math.round((Math.abs(diff) / prevTotal) * 100);
  const improved = diff > 0;
  const unchanged = diff === 0;

  return (
    <p
      className="text-sm font-medium"
      style={{ color: unchanged ? "var(--text-secondary)" : improved ? "var(--good)" : "var(--serious)" }}
    >
      {unchanged
        ? "지난번과 습관 언급 횟수가 같아요."
        : improved
          ? `지난번보다 ${percent}% 줄었어요 👍`
          : `지난번보다 ${percent}% 늘었어요`}
    </p>
  );
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: recording } = await supabase
    .from("recordings")
    .select("*")
    .eq("id", id)
    .single<Recording>();

  if (!recording) notFound();

  const { data: previous } = await supabase
    .from("recordings")
    .select("*")
    .lt("created_at", recording.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Recording>();

  const habits = recording.detected_habits ?? [];
  const habitCounts = Object.fromEntries(habits.map((h) => [h.expression, h.count]));
  const minutes = Math.max(recording.duration_seconds / 60, 1 / 60);
  const perMinute = Math.round(((recording.total_habit_mentions ?? 0) / minutes) * 10) / 10;

  return (
    <main className="flex-1 flex flex-col gap-8 px-6 py-12 max-w-xl mx-auto w-full">
      <section className="text-center">
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          이번 녹음에서 발견된 습관 언급
        </p>
        <p className="text-5xl font-semibold mt-1">{recording.total_habit_mentions ?? 0}회</p>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          분당 {perMinute}회
        </p>
        <div className="mt-3">
          <ComparisonNote current={recording} previous={previous ?? null} />
        </div>
      </section>

      {recording.syllables_per_minute > 0 && (
        <section className="flex items-center justify-center gap-2 text-sm">
          <span style={{ color: "var(--text-secondary)" }}>말하기 속도</span>
          <span className="font-semibold tabular-nums">{recording.syllables_per_minute}음절/분</span>
          <span
            className="text-xs font-semibold rounded-full px-2 py-0.5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            {speedLabel(recording.syllables_per_minute)}
          </span>
        </section>
      )}

      <AudioPlayback id={recording.id} />

      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>
          이번 녹음에서 발견된 습관
        </h2>
        {habits.length > 0 ? (
          <>
            <BarChart counts={habitCounts} />
            <ul className="mt-3 flex flex-col gap-1">
              {habits.map((h) => (
                <li key={h.expression} className="text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
                    {h.expression}
                  </span>
                  {" · "}
                  {h.category} · &ldquo;{h.example}&rdquo;
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            이번 녹음에서는 뚜렷한 습관이 발견되지 않았어요.
          </p>
        )}
      </section>

      {recording.habit_summary && (
        <section
          className="rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
          style={{ background: "var(--series-1-soft)", color: "var(--foreground)" }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--series-1)" }}>
            AI 분석
          </p>
          {recording.habit_summary}
        </section>
      )}

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
