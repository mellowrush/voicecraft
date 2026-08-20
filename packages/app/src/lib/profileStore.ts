import { voiceProfileSchema, type VoiceProfile } from "@voicecraft/core";
import { predefinedProfiles } from "./predefinedProfiles";

export type ReadFile = () => Promise<string>;
export type WriteFile = (contents: string) => Promise<void>;

// lastUsedProfileId lives in this same file/store — the hotkey flow reads
// whichever profile the window app last selected, not a separate concept
// (see issue #21's decision).
export type ProfileStore = { profiles: VoiceProfile[]; lastUsedProfileId: string | null };

const EMPTY_STORE: ProfileStore = { profiles: [], lastUsedProfileId: null };

// Invalid entries are dropped rather than crashing the app — a malformed
// custom profile shouldn't take the whole store down with it.
function parseProfileArray(json: unknown): VoiceProfile[] {
  if (!Array.isArray(json)) return [];
  const profiles: VoiceProfile[] = [];
  for (const item of json) {
    const parsed = voiceProfileSchema.safeParse(item);
    if (parsed.success) profiles.push(parsed.data);
  }
  return profiles;
}

// Accepts both the current `{ profiles, lastUsedProfileId }` shape and the
// pre-#21 bare-array file format, for installs that already have a
// voice-profiles.json on disk.
export function parseProfilesFile(raw: string): ProfileStore {
  if (!raw.trim()) return EMPTY_STORE;

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return EMPTY_STORE;
  }

  if (Array.isArray(json)) return { profiles: parseProfileArray(json), lastUsedProfileId: null };
  if (typeof json !== "object" || json === null) return EMPTY_STORE;

  const record = json as Record<string, unknown>;
  const lastUsedProfileId = typeof record.lastUsedProfileId === "string" ? record.lastUsedProfileId : null;
  return { profiles: parseProfileArray(record.profiles), lastUsedProfileId };
}

export function serializeProfilesFile(store: ProfileStore): string {
  return JSON.stringify(store, null, 2);
}

// An empty store (missing file, or a file with no valid profile entries) is
// seeded with the predefined profiles on first load.
export async function loadProfiles(readFile: ReadFile, writeFile: WriteFile): Promise<ProfileStore> {
  const parsed = parseProfilesFile(await readFile());
  if (parsed.profiles.length > 0) return parsed;

  const seeded: ProfileStore = { profiles: predefinedProfiles, lastUsedProfileId: parsed.lastUsedProfileId };
  await writeFile(serializeProfilesFile(seeded));
  return seeded;
}
