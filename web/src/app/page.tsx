import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computeStatsSummary } from "@/lib/stats";
import { LogoutButton } from "@/components/LogoutButton";

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

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: recent }, { data: allForStats }, { data: topHabitRows }] = await Promise.all([
    supabase
      .from("recordings")
      .select("id, created_at, total_habit_mentions")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("recordings").select("total_habit_mentions, syllables_per_minute"),
    supabase
      .from("habit_profile")
      .select("expression, occurrences")
      .order("occurrences", { ascending: false })
      .limit(1),
  ]);

  const stats = computeStatsSummary(allForStats ?? [], topHabitRows?.[0] ?? null);

  return (
    <main className="flex-1 flex flex-col items-center gap-10 px-6 py-16 max-w-xl mx-auto w-full">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">음어탐지기</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          발표를 녹음하면 AI가 당신만의 말하기 습관을 찾아서 쌓아드려요.
        </p>
      </div>

      <Link
        href="/record"
        className="w-full max-w-xs text-center rounded-full py-4 text-lg font-semibold text-white shadow"
        style={{ background: "var(--series-1)" }}
      >
        녹음 시작
      </Link>

      {stats.totalRecordings > 0 && (
        <section className="w-full grid grid-cols-2 gap-3">
          <StatTile label="누적 녹음" value={`${stats.totalRecordings}회`} />
          <StatTile label="평균 습관 언급" value={`${stats.averageHabitMentions}회`} />
          <StatTile label="최다 습관" value={stats.topHabit ? `${stats.topHabit.expression}` : "-"} />
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
        {!recent || recent.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            아직 녹음 기록이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/result/${r.id}`}
                  className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <span className="text-sm">
                    {new Date(r.created_at).toLocaleString("ko-KR", {
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
                    습관 언급 {r.total_habit_mentions ?? 0}회
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {recent && recent.length > 0 && (
          <Link
            href="/history"
            className="mt-3 inline-block text-sm underline"
            style={{ color: "var(--text-secondary)" }}
          >
            히스토리 전체 보기
          </Link>
        )}
      </section>

      <LogoutButton />
    </main>
  );
}
