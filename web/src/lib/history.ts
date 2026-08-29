"use client";

import type { Recording } from "./types";
import { deleteAudio } from "./audioStore";

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
  averageFillerCount: number;
  topWord: { word: string; count: number } | null;
  averageSyllablesPerMinute: number | null;
}

export function getStatsSummary(): StatsSummary {
  const all = getRecordings();
  if (all.length === 0) {
    return { totalRecordings: 0, averageFillerCount: 0, topWord: null, averageSyllablesPerMinute: null };
  }

  const totalFillerCount = all.reduce((sum, r) => sum + r.totalFillerCount, 0);
  const averageFillerCount = Math.round((totalFillerCount / all.length) * 10) / 10;

  const wordTotals: Record<string, number> = {};
  for (const r of all) {
    for (const [word, count] of Object.entries(r.fillerCounts)) {
      wordTotals[word] = (wordTotals[word] ?? 0) + count;
    }
  }
  const topEntry = Object.entries(wordTotals).sort((a, b) => b[1] - a[1])[0];
  const topWord = topEntry && topEntry[1] > 0 ? { word: topEntry[0], count: topEntry[1] } : null;

  // Older recordings predate this field, so only average over ones that have it.
  const withSpeed = all.filter((r) => r.syllablesPerMinute > 0);
  const averageSyllablesPerMinute =
    withSpeed.length > 0
      ? Math.round(withSpeed.reduce((sum, r) => sum + r.syllablesPerMinute, 0) / withSpeed.length)
      : null;

  return { totalRecordings: all.length, averageFillerCount, topWord, averageSyllablesPerMinute };
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
