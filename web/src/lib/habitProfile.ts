"use client";

import type { DetectedHabit } from "./habitAnalysis";

// The cross-recording "what are my habits" profile — built up over time by
// merging each recording's freshly-detected habits into a running total,
// matched by exact expression text. This is the actual point of the
// AI-analysis approach: a fixed dictionary can't discover a user's own
// specific tics, but it also can't accumulate on its own — this module is
// the accumulation half.

export interface ProfileHabit {
  expression: string;
  category: string;
  example: string;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

const STORAGE_KEY = "mal-beoreut:habit-profile";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getHabitProfile(): ProfileHabit[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalize(expression: string): string {
  return expression.trim();
}

/** Merges this recording's detected habits into the running profile and persists it. */
export function mergeHabitsIntoProfile(
  newHabits: DetectedHabit[],
  timestamp: string
): ProfileHabit[] {
  if (!isBrowser()) return [];
  const profile = getHabitProfile();
  const byExpression = new Map(profile.map((h) => [normalize(h.expression), h]));

  for (const habit of newHabits) {
    const key = normalize(habit.expression);
    const existing = byExpression.get(key);
    if (existing) {
      existing.occurrences += habit.count;
      existing.lastSeenAt = timestamp;
      existing.example = habit.example || existing.example;
    } else {
      byExpression.set(key, {
        expression: habit.expression,
        category: habit.category,
        example: habit.example,
        occurrences: habit.count,
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
      });
    }
  }

  const next = Array.from(byExpression.values()).sort((a, b) => b.occurrences - a.occurrences);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** Top expressions to feed back into the next analysis call as "already known". */
export function getKnownExpressions(limit = 15): string[] {
  return getHabitProfile()
    .slice(0, limit)
    .map((h) => h.expression);
}
