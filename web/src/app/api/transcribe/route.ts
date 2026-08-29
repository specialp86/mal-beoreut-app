import { NextResponse } from "next/server";
import { countFillerWords } from "@/lib/filler-words";
import { getSttProvider } from "@/lib/stt";
import { generateCoachingTip } from "@/lib/coach";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "audio file is required" }, { status: 400 });
  }

  const provider = getSttProvider();
  const arrayBuffer = await file.arrayBuffer();
  const audio = Buffer.from(arrayBuffer);

  try {
    const { text } = await provider.transcribe({
      audio,
      filename: file instanceof File ? file.name : "recording.webm",
      mimeType: file.type || "audio/webm",
    });
    const { counts, total } = countFillerWords(text);

    let coachingTip: string | null = null;
    try {
      coachingTip = await generateCoachingTip(text, counts);
    } catch {
      // Coaching is a nice-to-have; a failure here shouldn't fail the whole request.
      coachingTip = null;
    }

    return NextResponse.json({
      transcriptText: text,
      fillerCounts: counts,
      totalFillerCount: total,
      sttProvider: provider.name,
      coachingTip,
    });
  } catch (err) {
    console.error("STT request failed:", err);
    const tooLong = err instanceof Error && err.message.startsWith("AUDIO_TOO_LONG:");
    return NextResponse.json(
      {
        error: tooLong
          ? "녹음이 너무 길어요. 1분 이내로 다시 녹음해주세요."
          : "음성 인식에 실패했어요. 잠시 후 다시 시도해주세요.",
      },
      { status: 502 }
    );
  }
}
