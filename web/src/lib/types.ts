import type { DetectedHabit } from "./habitAnalysis";

/** Shape of a row in the `recordings` table (snake_case, matches the DB). */
export interface Recording {
  id: string;
  created_at: string;
  duration_seconds: number;
  transcript_text: string;
  stt_provider: string;
  syllables_per_minute: number;
  total_habit_mentions: number;
  habit_summary: string | null;
  detected_habits: DetectedHabit[];
}
