import type { SttProvider } from "./types";

/**
 * Dev-only provider so the record -> analyze -> result flow can be tested
 * without any API keys. Returns a fixed sample transcript instead of real
 * recognition. Selected by default when STT_PROVIDER is unset.
 */
export const mockProvider: SttProvider = {
  name: "mock",
  async transcribe() {
    return {
      text:
        "음 그니까 오늘 발표는 어 이렇게 시작하겠습니다 일단 약간 " +
        "긴장이 되는데요 이제 본론으로 들어가서 그래서 결론을 말씀드리면",
    };
  },
};
