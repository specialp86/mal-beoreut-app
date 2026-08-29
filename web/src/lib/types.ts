import type { FillerCounts } from "./filler-words";

export interface Recording {
  id: string;
  createdAt: string; // ISO timestamp
  durationSeconds: number;
  transcriptText: string;
  fillerCounts: FillerCounts;
  totalFillerCount: number;
  sttProvider: string;
  coachingTip?: string | null;
}
