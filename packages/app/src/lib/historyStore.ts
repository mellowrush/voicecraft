import type { GenerationOptions, Mode } from "@voicecraft/core";
import { isVendor, type Vendor } from "./vendor";

// One row of Voicecraft's generation history, per ADR-0008 — persisted as
// one JSON line per entry in history.jsonl (append-only, not a whole-file
// JSON array like voice-profiles.json).
// Raw token usage for this call — zero for a dedupe hit, since no API call
// was made (ADR-0009 / #94).
export type HistoryEntryUsage = { inputTokens: number; outputTokens: number; cacheReadTokens?: number };

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
  usage: HistoryEntryUsage;
  dedupeHit: boolean;
  compressed: boolean;
  // The tokens the original (non-cached) call cost — only set on a dedupe
  // hit, so savings stay computable from history.jsonl alone even after the
  // underlying generation-cache.json entry is evicted (#86/#87/#90).
  savedUsage?: HistoryEntryUsage;
};

// The fields present on every entry ever written, pre- and post-#94 —
// checked structurally; usage/dedupeHit/compressed are backfilled by
// parseHistoryFile below rather than required here, so pre-#94 lines aren't
// dropped as malformed.
type LegacyHistoryEntry = Omit<HistoryEntry, "usage" | "dedupeHit" | "compressed" | "savedUsage">;

function isHistoryEntry(value: unknown): value is LegacyHistoryEntry {
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
const ZERO_USAGE: HistoryEntryUsage = { inputTokens: 0, outputTokens: 0 };

export function parseHistoryFile(raw: string): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (isHistoryEntry(parsed)) {
        // Entries written before #94 have no usage/dedupeHit/compressed —
        // backfill rather than drop, so existing history survives the
        // schema extension instead of silently vanishing.
        entries.push({
          usage: ZERO_USAGE,
          dedupeHit: false,
          compressed: false,
          ...parsed,
        });
      }
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
