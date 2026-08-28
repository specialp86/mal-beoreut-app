import fillerWordData from "./filler-words.json";

export type FillerWordCategory = "감탄사" | "접속어" | "군더더기어";

export interface FillerWord {
  word: string;
  category: FillerWordCategory;
}

export const FILLER_WORDS: FillerWord[] = fillerWordData as FillerWord[];

export type FillerCounts = Record<string, number>;

export interface FillerCountResult {
  counts: FillerCounts;
  total: number;
}

/**
 * Naive dictionary matching on whitespace-delimited tokens (exact match after
 * stripping trailing punctuation). Good enough for MVP; a morphological
 * analyzer is the v2 upgrade path noted in the spec.
 */
export function countFillerWords(transcript: string): FillerCountResult {
  const counts: FillerCounts = {};
  for (const { word } of FILLER_WORDS) counts[word] = 0;

  const tokens = transcript
    .split(/\s+/)
    .map((t) => t.replace(/^[.,!?~"'()[\]{}…·]+|[.,!?~"'()[\]{}…·]+$/g, ""))
    .filter(Boolean);

  for (const token of tokens) {
    if (Object.prototype.hasOwnProperty.call(counts, token)) {
      counts[token] += 1;
    }
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts, total };
}
