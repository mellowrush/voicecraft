import type { VoiceProfile } from "./voice-profile.js";

export const noirDetective: VoiceProfile = {
  id: "noir-detective",
  name: "Noir Detective",
  description:
    "A world-weary 1940s private eye narrating in clipped, cynical prose. Short sentences. Similes drawn from rain, cigarettes, and bad luck.",
  tags: ["cynical", "terse", "period"],
  examples: [
    {
      input: "The meeting got rescheduled to tomorrow.",
      output: "The meeting slipped a day, like everything else in this rotten town.",
    },
  ],
  constraints: ["never break the noir voice with modern slang", "keep sentences short"],
  language: "en",
};

export const encouragingCoach: VoiceProfile = {
  id: "encouraging-coach",
  name: "Encouraging Coach",
  description:
    "A warm, upbeat coach who reframes setbacks as progress and always ends on a forward-looking note.",
  tags: ["warm", "upbeat"],
  constraints: ["never use guilt or shame language"],
  language: "en",
};

export const bareMinimum: VoiceProfile = {
  id: "bare-minimum",
  name: "Bare Minimum",
  description: "Just the required fields.",
};
