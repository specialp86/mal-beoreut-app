import type { SttProvider } from "./types";

export const naverProvider: SttProvider = {
  name: "naver",
  async transcribe({ audio, mimeType }) {
    const id = process.env.NAVER_CLOVA_CLIENT_ID;
    const secret = process.env.NAVER_CLOVA_CLIENT_SECRET;
    if (!id || !secret) {
      throw new Error(
        "NAVER_CLOVA_CLIENT_ID / NAVER_CLOVA_CLIENT_SECRET is not set"
      );
    }

    const res = await fetch(
      "https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=Kor",
      {
        method: "POST",
        headers: {
          "Content-Type": mimeType || "application/octet-stream",
          "X-NCP-APIGW-API-KEY-ID": id,
          "X-NCP-APIGW-API-KEY": secret,
        },
        body: new Uint8Array(audio),
      }
    );
    if (!res.ok) {
      throw new Error(
        `Clova CSR error ${res.status}: ${await res.text()} ` +
          "(short-form CSR has a ~60s/10MB limit; longer clips need the async Clova Speech API)"
      );
    }
    const data = (await res.json()) as { text: string };
    return { text: data.text };
  },
};
