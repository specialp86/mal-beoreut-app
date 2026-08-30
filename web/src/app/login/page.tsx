"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#000000"
        fillOpacity={0.85}
        d="M9 1.5C4.31 1.5.5 4.48.5 8.16c0 2.35 1.56 4.42 3.92 5.6-.17.63-.63 2.3-.72 2.66-.11.44.16.44.34.32.14-.1 2.24-1.52 3.15-2.14.6.09 1.21.13 1.81.13 4.69 0 8.5-2.98 8.5-6.66S13.69 1.5 9 1.5z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState<"google" | "kakao" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInWith(provider: "google" | "kakao") {
    setLoading(provider);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (signInError) {
      setLoading(null);
      setError(signInError.message);
    }
    // On success, the browser is redirected away to the provider — no further
    // client-side state change happens here.
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">음어탐지기</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
          로그인하면 내 말하기 습관이 기기와 상관없이 저장돼요.
        </p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-3">
        <button
          onClick={() => signInWith("kakao")}
          disabled={loading !== null}
          className="w-full rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: "#FEE500", color: "#000000" }}
        >
          <KakaoIcon />
          {loading === "kakao" ? "이동 중..." : "카카오로 계속하기"}
        </button>
        <button
          onClick={() => signInWith("google")}
          disabled={loading !== null}
          className="w-full rounded-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
        >
          <GoogleIcon />
          {loading === "google" ? "이동 중..." : "Google로 계속하기"}
        </button>
        {error && (
          <p className="text-sm text-center" style={{ color: "var(--serious)" }}>
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
