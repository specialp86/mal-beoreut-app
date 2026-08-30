import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrendChart, type TrendPoint } from "@/components/TrendChart";
import { BarChart } from "@/components/BarChart";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: byDateDesc }, { data: profile }] = await Promise.all([
    supabase
      .from("recordings")
      .select("id, created_at, total_habit_mentions")
      .order("created_at", { ascending: false }),
    supabase
      .from("habit_profile")
      .select("expression, occurrences")
      .order("occurrences", { ascending: false }),
  ]);

  const chronological = (byDateDesc ?? []).slice().reverse();
  const trendPoints: TrendPoint[] = chronological.map((r) => ({
    id: r.id,
    label: new Date(r.created_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }),
    value: r.total_habit_mentions ?? 0,
  }));

  const profileCounts = Object.fromEntries((profile ?? []).map((h) => [h.expression, h.occurrences]));

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
        {profile && profile.length > 0 ? (
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
        {!byDateDesc || byDateDesc.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            아직 녹음 기록이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {byDateDesc.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/result/${r.id}`}
                  className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <span className="text-sm">
                    {new Date(r.created_at).toLocaleString("ko-KR", {
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
                    습관 언급 {r.total_habit_mentions ?? 0}회
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
