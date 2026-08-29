import { NextResponse } from "next/server";
import { getSttProvider } from "@/lib/stt";
import { analyzeSpeechHabits } from "@/lib/habitAnalysis";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "audio file is required" }, { status: 400 });
  }
  const knownExpressionsRaw = formData.get("knownExpressions");
  const knownExpressions =
    typeof knownExpressionsRaw === "string" ? (JSON.parse(knownExpressionsRaw) as string[]) : [];

  const provider = getSttProvider();
  const arrayBuffer = await file.arrayBuffer();
  const audio = Buffer.from(arrayBuffer);

  try {
    const { text } = await provider.transcribe({
      audio,
      filename: file instanceof File ? file.name : "recording.webm",
      mimeType: file.type || "audio/webm",
    });

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

    return NextResponse.json({
      transcriptText: text,
      sttProvider: provider.name,
      detectedHabits: analysis.habits,
      totalHabitMentions,
      habitSummary: analysis.summary || null,
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
