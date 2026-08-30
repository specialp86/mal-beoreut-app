// Speaking rate in syllables/minute (Hangul syllable blocks), the standard
// unit for Korean speech rate — more reliable than a word/eojeol count,
// which varies too much with spacing habits and STT formatting.

export function countSyllables(text: string): number {
  const matches = text.match(/[가-힣]/g);
  return matches ? matches.length : 0;
}

export function calculateSyllablesPerMinute(text: string, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  const syllables = countSyllables(text);
  return Math.round((syllables / durationSeconds) * 60);
}

export type SpeedLabel = "느림" | "보통" | "빠름";

/**
 * Rough reference bands for conversational Korean speech, not a clinical
 * standard — just enough to give the raw number some context.
 */
export function speedLabel(syllablesPerMinute: number): SpeedLabel {
  if (syllablesPerMinute < 250) return "느림";
  if (syllablesPerMinute > 400) return "빠름";
  return "보통";
}
