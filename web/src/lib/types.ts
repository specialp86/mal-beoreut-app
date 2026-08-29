import type { DetectedHabit } from "./habitAnalysis";

export interface Recording {
  id: string;
  createdAt: string; // ISO timestamp
  durationSeconds: number;
  transcriptText: string;
  sttProvider: string;
  syllablesPerMinute: number;
  /** This recording's freely-detected habits (not a fixed dictionary). */
  detectedHabits: DetectedHabit[];
  totalHabitMentions: number;
  /** AI-written overview + practice suggestion; null if ANTHROPIC_API_KEY isn't set. */
  habitSummary: string | null;
}
