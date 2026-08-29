"use client";

import type { Recording } from "./types";
import { deleteAudio } from "./audioStore";
import { getHabitProfile } from "./habitProfile";

// NOTE: history is stored in the browser's localStorage for now. The spec
// calls for Vercel Postgres/Supabase (see docs), but that requires a
// provisioned database and credentials this environment doesn't have.
// Swapping this module for real API calls is the DB-integration step
// (spec section 7, step 8) — the rest of the app only depends on this
// module's function signatures, not on how it persists.

const STORAGE_KEY = "mal-beoreut:recordings";
const MAX_HISTORY = 50;

function isBrowser() {
  return typeof window !== "undefined";
}

export function getRecordings(): Recording[] {
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

export function getRecording(id: string): Recording | undefined {
  return getRecordings().find((r) => r.id === id);
}

export function addRecording(recording: Recording): void {
  if (!isBrowser()) return;
  const existing = getRecordings();
  const next = [recording, ...existing].slice(0, MAX_HISTORY);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  const dropped = existing.slice(MAX_HISTORY - 1);
  for (const r of dropped) deleteAudio(r.id);
}

export interface StatsSummary {
  totalRecordings: number;
  averageHabitMentions: number;
  topHabit: { expression: string; occurrences: number } | null;
  averageSyllablesPerMinute: number | null;
}

export function getStatsSummary(): StatsSummary {
  const all = getRecordings();
  if (all.length === 0) {
    return { totalRecordings: 0, averageHabitMentions: 0, topHabit: null, averageSyllablesPerMinute: null };
  }

  // Older recordings predate these fields, so guard with `?? 0` / `?? []`.
  const totalMentions = all.reduce((sum, r) => sum + (r.totalHabitMentions ?? 0), 0);
  const averageHabitMentions = Math.round((totalMentions / all.length) * 10) / 10;

  const topProfileHabit = getHabitProfile()[0];
  const topHabit = topProfileHabit
    ? { expression: topProfileHabit.expression, occurrences: topProfileHabit.occurrences }
    : null;

  const withSpeed = all.filter((r) => r.syllablesPerMinute > 0);
  const averageSyllablesPerMinute =
    withSpeed.length > 0
      ? Math.round(withSpeed.reduce((sum, r) => sum + r.syllablesPerMinute, 0) / withSpeed.length)
      : null;

  return { totalRecordings: all.length, averageHabitMentions, topHabit, averageSyllablesPerMinute };
}

/** The recording immediately before `id` in time, for the comparison text. */
export function getPreviousRecording(id: string): Recording | undefined {
  const all = getRecordings()
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const index = all.findIndex((r) => r.id === id);
  if (index <= 0) return undefined;
  return all[index - 1];
}
