import { mockProvider } from "./mock";
import { openaiProvider } from "./openai";
import { naverProvider } from "./naver";
import { googleProvider } from "./google";
import type { SttProvider } from "./types";

export type { SttProvider, TranscribeInput, TranscribeResult } from "./types";

const providers: Record<string, SttProvider> = {
  mock: mockProvider,
  openai: openaiProvider,
  naver: naverProvider,
  google: googleProvider,
};

/**
 * Picks the STT backend via STT_PROVIDER (mock | openai | naver | google).
 * Defaults to "mock" so local dev works with no API keys. Once Phase 0
 * (docs/phase0-stt-comparison.md) picks a winner, set STT_PROVIDER in the
 * deployment env — no other code changes needed.
 */
export function getSttProvider(): SttProvider {
  const key = process.env.STT_PROVIDER?.trim().toLowerCase() || "mock";
  const provider = providers[key];
  if (!provider) {
    throw new Error(
      `Unknown STT_PROVIDER "${key}". Expected one of: ${Object.keys(providers).join(", ")}`
    );
  }
  return provider;
}
