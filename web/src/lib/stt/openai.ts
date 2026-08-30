import { FILLER_WORDS } from "../filler-words";
import type { SttProvider } from "./types";

export const openaiProvider: SttProvider = {
  name: "openai",
  async transcribe({ audio, filename, mimeType }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), filename);
    form.append("model", "whisper-1");
    form.append("language", "ko");
    form.append(
      "prompt",
      FILLER_WORDS.map((f) => f.word).join(", ") +
        " 등 필러워드를 그대로 살려서 받아써주세요."
    );
    form.append("response_format", "json");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Whisper API error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { text: string };
    return { text: data.text };
  },
};
