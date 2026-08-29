import Anthropic from "@anthropic-ai/sdk";
import type { FillerCounts } from "./filler-words";

const MODEL = "claude-haiku-4-5-20251001";

/**
 * Turns a raw filler-word count into a short, specific improvement tip.
 * Optional feature: returns null when ANTHROPIC_API_KEY isn't set (same
 * skip-gracefully pattern as the STT providers) or when there's nothing
 * worth coaching on.
 */
export async function generateCoachingTip(
  transcriptText: string,
  fillerCounts: FillerCounts
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const usedWords = Object.entries(fillerCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  if (usedWords.length === 0) return null;

  const client = new Anthropic({ apiKey });

  const wordSummary = usedWords.map(([word, count]) => `${word}(${count}회)`).join(", ");
  const transcriptExcerpt = transcriptText.slice(0, 1000);

  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 300,
      system:
      "당신은 발표 습관어를 교정해주는 스피치 코치입니다. 사용자의 발화 습관어 통계와 " +
      "실제 발화 일부를 보고, 가장 두드러진 습관어 1~2개를 짚어 왜 그런 습관이 생겼을지 " +
      "짧게 짚고, 오늘 당장 시도할 수 있는 구체적인 연습법을 한국어로 2~3문장 안에 제안하세요. " +
      "일반론(예: '천천히 말하세요')이 아니라 발화 내용에 비추어 구체적으로 조언하세요. " +
      "마크다운 문법(#, **, - 등)이나 제목 없이, 줄바꿈 없는 순수 문장으로만 답하세요.",
      messages: [
        {
          role: "user",
          content:
            `필러워드 통계: ${wordSummary}\n\n` +
            `발화 내용(일부): "${transcriptExcerpt}"`,
        },
      ],
    },
    { timeout: 12_000 }
  );

  const textBlock = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text"
  );
  return textBlock?.text.trim() ?? null;
}
