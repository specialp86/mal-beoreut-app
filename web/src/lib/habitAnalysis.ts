import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const MODEL = "claude-haiku-4-5-20251001";

export const HabitCategory = z.enum(["간투사", "접속어", "말버릇 표현", "문장 패턴"]);

const HabitSchema = z.object({
  expression: z
    .string()
    .describe(
      "실제로 반복 관찰된 짧은 단어/구절 자체 (예: '그니까', '인 것 같아요'). 서술형 문장이 아님. " +
        "이미 알려진 습관 목록에 같은 습관이 있으면 반드시 그 표현을 그대로 재사용할 것."
    ),
  category: HabitCategory,
  example: z.string().describe("발화에서 그대로 인용한 예시 구절"),
  count: z.number().int().min(1).describe("이번 발화에서 등장한 횟수"),
});

const HabitAnalysisSchema = z.object({
  habits: z.array(HabitSchema).max(8),
  summary: z
    .string()
    .describe("전반적인 말하기 습관에 대한 한국어 요약과 오늘 시도해볼 구체적 연습법, 2~3문장, 마크다운 없이"),
});

export type DetectedHabit = z.infer<typeof HabitSchema>;
export type HabitAnalysisResult = z.infer<typeof HabitAnalysisSchema>;

/**
 * Open-ended speech-habit discovery: no predefined word list. The model
 * freely identifies whatever recurring patterns show up in this transcript.
 * `knownExpressions` (the user's accumulated habit profile so far) is passed
 * back in so the model reuses the same label for a recurring habit instead
 * of inventing a new phrasing each time — that's what makes cross-recording
 * accumulation in habitProfile.ts actually work.
 *
 * Returns null when ANTHROPIC_API_KEY isn't set — this is now the core
 * analysis, not an optional extra, so a null result should be surfaced to
 * the user rather than silently treated as "no habits found".
 */
export async function analyzeSpeechHabits(
  transcriptText: string,
  knownExpressions: string[]
): Promise<HabitAnalysisResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!transcriptText.trim()) return { habits: [], summary: "" };

  const client = new Anthropic({ apiKey });

  const response = await client.messages.parse(
    {
      model: MODEL,
      max_tokens: 1000,
      system:
        "당신은 한국어 발화에서 화자의 반복적인 말하기 습관(간투사, 접속어 남용, 특정 어미/표현의 " +
        "반복, 문장 시작 패턴 등)을 찾아내는 분석가입니다. 미리 정해진 단어 목록은 없습니다 — 실제 " +
        "발화에서 관찰되는 패턴을 자유롭게 찾아내세요. 이미 알려진 습관 목록이 주어지면, 같은 습관이 " +
        "이번 발화에도 나타났을 때 반드시 동일한 expression 값을 그대로 사용하세요 — 새 이름을 " +
        "만들지 마세요. 이번 발화에 실제로 등장하지 않은 습관은 포함하지 마세요.",
      messages: [
        {
          role: "user",
          content:
            (knownExpressions.length > 0
              ? `이미 알려진 습관: ${knownExpressions.join(", ")}\n\n`
              : "") + `발화 내용: "${transcriptText.slice(0, 4000)}"`,
        },
      ],
      output_config: { format: zodOutputFormat(HabitAnalysisSchema) },
    },
    { timeout: 15_000 }
  );

  return response.parsed_output ?? { habits: [], summary: "" };
}
