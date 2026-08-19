import type { VoiceProfile } from "@voicecraft/core";

export const predefinedProfiles: VoiceProfile[] = [
  {
    id: "straight-shooter",
    name: "Straight Shooter",
    description: "Blunt, no fluff, gets to the point in as few words as possible.",
  },
  {
    id: "warm-encouraging",
    name: "Warm & Encouraging",
    description: "Friendly, supportive tone, softens criticism, uses encouraging language.",
  },
  {
    id: "formal-memo",
    name: "Formal Memo",
    description: "Corporate-formal register, third person where natural, no contractions.",
  },
];

const predefinedIds = new Set(predefinedProfiles.map((p) => p.id));

export function isPredefined(profile: VoiceProfile): boolean {
  return predefinedIds.has(profile.id);
}
