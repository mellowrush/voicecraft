import type { VoiceProfile } from "@voicecraft/core";

// Falls back to the first available profile rather than showing an error —
// a stale/missing lastUsedProfileId shouldn't block the hotkey flow.
export function pickHudProfile(profiles: VoiceProfile[], profileId: string | null): VoiceProfile | null {
  if (profileId) {
    const match = profiles.find((p) => p.id === profileId);
    if (match) return match;
  }
  return profiles[0] ?? null;
}
