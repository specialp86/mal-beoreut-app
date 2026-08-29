import type { SttProvider } from "./types";

function encodingForMimeType(mimeType: string): {
  encoding: string;
  sampleRateHertz?: number;
} {
  if (mimeType.includes("webm")) return { encoding: "WEBM_OPUS" };
  if (mimeType.includes("ogg")) return { encoding: "OGG_OPUS" };
  if (mimeType.includes("wav")) return { encoding: "LINEAR16", sampleRateHertz: 16000 };
  if (mimeType.includes("flac")) return { encoding: "FLAC", sampleRateHertz: 16000 };
  return { encoding: "WEBM_OPUS" };
}

/**
 * Uses the synchronous speech:recognize endpoint rather than
 * longrunningrecognize + polling. Google caps sync recognize at ~1 minute of
 * audio, but that cap is what keeps this inside a serverless function's
 * request duration (no background job infra here) — the tradeoff is
 * short-recording-only support in this deployment.
 */
export const googleProvider: SttProvider = {
  name: "google",
  async transcribe({ audio, mimeType }) {
    const apiKey = process.env.GOOGLE_STT_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_STT_API_KEY is not set");

    const { encoding, sampleRateHertz } = encodingForMimeType(mimeType);
    const content = audio.toString("base64");

    const res = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            encoding,
            ...(sampleRateHertz ? { sampleRateHertz } : {}),
            languageCode: "ko-KR",
            enableAutomaticPunctuation: false,
          },
          audio: { content },
        }),
      }
    );
    if (!res.ok) {
      throw new Error(
        `Google STT error ${res.status}: ${await res.text()} ` +
          "(sync recognize supports at most ~1 minute of audio — try a shorter recording)"
      );
    }
    const data = await res.json();
    const results = data.results ?? [];
    const text = results
      .map((r: { alternatives?: { transcript?: string }[] }) => r.alternatives?.[0]?.transcript ?? "")
      .join(" ")
      .trim();
    return { text };
  },
};
