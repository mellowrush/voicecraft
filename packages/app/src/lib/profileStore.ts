import { voiceProfileSchema, type VoiceProfile } from "@voicecraft/core";
import { predefinedProfiles } from "./predefinedProfiles";

export type ReadFile = () => Promise<string>;
export type WriteFile = (contents: string) => Promise<void>;

// Invalid entries are dropped rather than crashing the app — a malformed
// custom profile shouldn't take the whole store down with it.
export function parseProfilesFile(raw: string): VoiceProfile[] {
  if (!raw.trim()) return [];

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(json)) return [];

  const profiles: VoiceProfile[] = [];
  for (const item of json) {
    const parsed = voiceProfileSchema.safeParse(item);
    if (parsed.success) profiles.push(parsed.data);
  }
  return profiles;
}

export function serializeProfiles(profiles: VoiceProfile[]): string {
  return JSON.stringify(profiles, null, 2);
}

// An empty store (missing file, or a file with no valid entries) is seeded
// with the predefined profiles on first load.
export async function loadProfiles(readFile: ReadFile, writeFile: WriteFile): Promise<VoiceProfile[]> {
  const raw = await readFile();
  const parsed = parseProfilesFile(raw);
  if (parsed.length > 0) return parsed;

  await writeFile(serializeProfiles(predefinedProfiles));
  return predefinedProfiles;
}

export async function saveProfiles(profiles: VoiceProfile[], writeFile: WriteFile): Promise<void> {
  await writeFile(serializeProfiles(profiles));
}
