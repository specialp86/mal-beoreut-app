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

export const googleProvider: SttProvider = {
  name: "google",
  async transcribe({ audio, mimeType }) {
    const apiKey = process.env.GOOGLE_STT_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_STT_API_KEY is not set");

    const { encoding, sampleRateHertz } = encodingForMimeType(mimeType);
    const content = audio.toString("base64");

    const startRes = await fetch(
      `https://speech.googleapis.com/v1/speech:longrunningrecognize?key=${apiKey}`,
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
    if (!startRes.ok) {
      throw new Error(
        `Google STT start error ${startRes.status}: ${await startRes.text()}`
      );
    }
    const { name: operationName } = (await startRes.json()) as { name: string };

    const deadline = Date.now() + 2 * 60 * 1000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(
        `https://speech.googleapis.com/v1/operations/${operationName}?key=${apiKey}`
      );
      if (!pollRes.ok) {
        throw new Error(
          `Google STT poll error ${pollRes.status}: ${await pollRes.text()}`
        );
      }
      const op = await pollRes.json();
      if (op.done) {
        const results = op.response?.results ?? [];
        const text = results
          .map((r: { alternatives?: { transcript?: string }[] }) =>
            r.alternatives?.[0]?.transcript ?? ""
          )
          .join(" ")
          .trim();
        return { text };
      }
    }
    throw new Error("Google STT operation timed out after 2 minutes");
  },
};
