"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (signInError) {
      setStatus("error");
      setError(signInError.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">음어탐지기</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          이메일로 로그인하면 내 말하기 습관이 기기와 상관없이 저장돼요.
        </p>
      </div>

      {status === "sent" ? (
        <p className="text-sm text-center max-w-xs" style={{ color: "var(--good)" }}>
          {email}로 로그인 링크를 보냈어요. 메일함을 확인해주세요.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 주소"
            className="w-full rounded-lg px-4 py-3 text-sm"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-full py-3 text-sm font-semibold text-white shadow"
            style={{ background: "var(--series-1)" }}
          >
            {status === "sending" ? "전송 중..." : "로그인 링크 받기"}
          </button>
          {error && (
            <p className="text-sm" style={{ color: "var(--serious)" }}>
              {error}
            </p>
          )}
        </form>
      )}
    </main>
  );
}
