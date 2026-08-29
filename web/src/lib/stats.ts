export interface StatsSummary {
  totalRecordings: number;
  averageHabitMentions: number;
  topHabit: { expression: string; occurrences: number } | null;
  averageSyllablesPerMinute: number | null;
}

export function computeStatsSummary(
  recordings: { total_habit_mentions: number; syllables_per_minute: number }[],
  topHabitRow: { expression: string; occurrences: number } | null
): StatsSummary {
  if (recordings.length === 0) {
    return { totalRecordings: 0, averageHabitMentions: 0, topHabit: null, averageSyllablesPerMinute: null };
  }

  const totalMentions = recordings.reduce((sum, r) => sum + (r.total_habit_mentions ?? 0), 0);
  const averageHabitMentions = Math.round((totalMentions / recordings.length) * 10) / 10;

  const withSpeed = recordings.filter((r) => r.syllables_per_minute > 0);
  const averageSyllablesPerMinute =
    withSpeed.length > 0
      ? Math.round(withSpeed.reduce((sum, r) => sum + r.syllables_per_minute, 0) / withSpeed.length)
      : null;

  return {
    totalRecordings: recordings.length,
    averageHabitMentions,
    topHabit: topHabitRow,
    averageSyllablesPerMinute,
  };
}
