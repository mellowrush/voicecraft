import type { GenerationOptions, Mode } from "@voicecraft/core";
import { isVendor, type Vendor } from "./vendor";

// One row of Voicecraft's generation history, per ADR-0008 — persisted as
// one JSON line per entry in history.jsonl (append-only, not a whole-file
// JSON array like voice-profiles.json).
export type HistoryEntry = {
  id: string;
  createdAt: string;
  profileId: string;
  profileName: string;
  vendor: Vendor;
  mode: Mode;
  inputText: string;
  context?: string;
  options?: GenerationOptions;
  variants: string[];
};

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.createdAt === "string" &&
    typeof v.profileId === "string" &&
    typeof v.profileName === "string" &&
    isVendor(v.vendor) &&
    (v.mode === "rewrite" || v.mode === "generate") &&
    typeof v.inputText === "string" &&
    Array.isArray(v.variants)
  );
}

// Invalid or malformed lines are dropped rather than failing the whole file
// — the same policy profileStore.ts applies to a malformed custom profile.
export function parseHistoryFile(raw: string): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (isHistoryEntry(parsed)) entries.push(parsed);
    } catch {
      // drop malformed line, keep going
    }
  }
  return entries;
}

// No pretty-printing — must stay a single line for the append-only JSONL
// format; JSON.stringify already escapes any newline in string content, so
// this can never accidentally emit a literal line break.
export function serializeHistoryEntry(entry: HistoryEntry): string {
  return JSON.stringify(entry);
}
