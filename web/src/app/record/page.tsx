"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MAX_RECORDING_SECONDS, useRecorder } from "@/lib/useRecorder";
import { addRecording } from "@/lib/history";

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function RecordPage() {
  const router = useRouter();
  const { status, elapsedSeconds, error, audioBlob, start, stop } = useRecorder();
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "stopped" || !audioBlob) return;

    let cancelled = false;
    async function analyze(blob: Blob) {
      setAnalyzing(true);
      setAnalyzeError(null);
      try {
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        const res = await fetch("/api/transcribe", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "분석에 실패했습니다.");
        if (cancelled) return;

        const id = crypto.randomUUID();
        addRecording({
          id,
          createdAt: new Date().toISOString(),
          durationSeconds: elapsedSeconds,
          transcriptText: data.transcriptText,
          fillerCounts: data.fillerCounts,
          totalFillerCount: data.totalFillerCount,
          sttProvider: data.sttProvider,
          coachingTip: data.coachingTip ?? null,
        });
        router.push(`/result?id=${id}`);
      } catch (err) {
        if (!cancelled) {
          setAnalyzeError(err instanceof Error ? err.message : "분석에 실패했습니다.");
          setAnalyzing(false);
        }
      }
    }
    analyze(audioBlob);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, audioBlob]);

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-8 px-6 py-16">
      {status === "idle" || status === "requesting" || status === "error" ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            1~5분 사이로 발표를 리허설해보세요.
          </p>
          <button
            onClick={start}
            disabled={status === "requesting"}
            className="rounded-full px-8 py-4 text-lg font-semibold text-white shadow"
            style={{ background: "var(--series-1)" }}
          >
            {status === "requesting" ? "마이크 준비 중..." : "녹음 시작"}
          </button>
          {(error || analyzeError) && (
            <p className="text-sm" style={{ color: "var(--serious)" }}>
              {error || analyzeError}
            </p>
          )}
        </div>
      ) : status === "recording" ? (
        <div className="flex flex-col items-center gap-6">
          <div className="text-5xl font-semibold tabular-nums">{formatTime(elapsedSeconds)}</div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            최대 {formatTime(MAX_RECORDING_SECONDS)}
          </p>
          <button
            onClick={stop}
            className="rounded-full px-8 py-4 text-lg font-semibold text-white shadow"
            style={{ background: "var(--serious)" }}
          >
            정지
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div
            className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: "var(--series-1)", borderTopColor: "transparent" }}
          />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {analyzing ? "분석 중입니다..." : "완료"}
          </p>
        </div>
      )}
    </main>
  );
}
