import { NextResponse } from "next/server";
import { getSttProvider } from "@/lib/stt";
import { analyzeSpeechHabits } from "@/lib/habitAnalysis";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "audio file is required" }, { status: 400 });
  }
  const durationSecondsRaw = formData.get("durationSeconds");
  const durationSeconds =
    typeof durationSecondsRaw === "string" ? Number(durationSecondsRaw) : 0;

  const provider = getSttProvider();
  const arrayBuffer = await file.arrayBuffer();
  const audio = Buffer.from(arrayBuffer);

  try {
    const { text } = await provider.transcribe({
      audio,
      filename: file instanceof File ? file.name : "recording.webm",
      mimeType: file.type || "audio/webm",
    });

    // Feed the user's already-known habits back in so the model reuses the
    // same expression label for a recurring habit instead of relabeling it —
    // that's what makes the DB-side accumulation below actually work.
    const { data: knownRows } = await supabase
      .from("habit_profile")
      .select("expression")
      .eq("user_id", user.id)
      .order("occurrences", { ascending: false })
      .limit(15);
    const knownExpressions = (knownRows ?? []).map((r) => r.expression);

    const analysis = await analyzeSpeechHabits(text, knownExpressions);
    if (analysis === null) {
      return NextResponse.json(
        {
          error:
            "말하기 습관 분석은 Claude API 키가 있어야 동작해요. ANTHROPIC_API_KEY를 설정해주세요.",
        },
        { status: 424 }
      );
    }

    const totalHabitMentions = analysis.habits.reduce((sum, h) => sum + h.count, 0);
    const syllables = (text.match(/[가-힣]/g) ?? []).length;
    const syllablesPerMinute =
      durationSeconds > 0 ? Math.round((syllables / durationSeconds) * 60) : 0;

    const { data: inserted, error: insertError } = await supabase
      .from("recordings")
      .insert({
        user_id: user.id,
        duration_seconds: durationSeconds,
        transcript_text: text,
        stt_provider: provider.name,
        syllables_per_minute: syllablesPerMinute,
        total_habit_mentions: totalHabitMentions,
        habit_summary: analysis.summary || null,
        detected_habits: analysis.habits,
      })
      .select("id, created_at")
      .single();

    if (insertError || !inserted) {
      console.error("Failed to save recording:", insertError);
      return NextResponse.json({ error: "결과 저장에 실패했어요." }, { status: 500 });
    }

    if (analysis.habits.length > 0) {
      const { error: mergeError } = await supabase.rpc("merge_habit_profile", {
        p_user_id: user.id,
        p_habits: analysis.habits,
        p_timestamp: inserted.created_at,
      });
      if (mergeError) console.error("Failed to merge habit profile:", mergeError);
    }

    return NextResponse.json({
      id: inserted.id,
      transcriptText: text,
      sttProvider: provider.name,
      detectedHabits: analysis.habits,
      totalHabitMentions,
      habitSummary: analysis.summary || null,
      syllablesPerMinute,
    });
  } catch (err) {
    console.error("Analysis request failed:", err);
    const tooLong = err instanceof Error && err.message.startsWith("AUDIO_TOO_LONG:");
    return NextResponse.json(
      {
        error: tooLong
          ? "녹음이 너무 길어요. 1분 이내로 다시 녹음해주세요."
          : "분석에 실패했어요. 잠시 후 다시 시도해주세요.",
      },
      { status: 502 }
    );
  }
}
