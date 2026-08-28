"use client";

import type { Recording } from "./types";

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
