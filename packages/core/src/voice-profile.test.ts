import { describe, expect, it } from "vitest";
import { voiceProfileSchema } from "./voice-profile.js";

const noirDetective = {
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
};

const encouragingCoach = {
  id: "encouraging-coach",
  name: "Encouraging Coach",
  description:
    "A warm, upbeat coach who reframes setbacks as progress and always ends on a forward-looking note.",
  tags: ["warm", "upbeat"],
  constraints: ["never use guilt or shame language"],
  language: "en",
};

const minimal = {
  id: "bare-minimum",
  name: "Bare Minimum",
  description: "Just the required fields.",
};

describe("voiceProfileSchema", () => {
  it("accepts a full profile with every optional field populated", () => {
    expect(voiceProfileSchema.safeParse(noirDetective).success).toBe(true);
    expect(voiceProfileSchema.safeParse(encouragingCoach).success).toBe(true);
  });

  it("accepts a minimal profile with only id/name/description", () => {
    expect(voiceProfileSchema.safeParse(minimal).success).toBe(true);
  });

  it("rejects a profile missing a required field", () => {
    const { name, ...missingName } = minimal;
    expect(voiceProfileSchema.safeParse(missingName).success).toBe(false);
  });

  it("rejects a profile with a wrong field type", () => {
    const wrongType = { ...minimal, tags: "not-an-array" };
    expect(voiceProfileSchema.safeParse(wrongType).success).toBe(false);
  });

  it("rejects a profile with an unexpected extra key", () => {
    const extraKey = { ...minimal, source: "predefined" };
    expect(voiceProfileSchema.safeParse(extraKey).success).toBe(false);
  });

  it("rejects an unexpected extra key on a nested example", () => {
    const extraExampleKey = {
      ...minimal,
      examples: [{ input: "a", output: "b", source: "predefined" }],
    };
    expect(voiceProfileSchema.safeParse(extraExampleKey).success).toBe(false);
  });

  it("rejects an empty id", () => {
    const emptyId = { ...minimal, id: "" };
    expect(voiceProfileSchema.safeParse(emptyId).success).toBe(false);
  });

  it("accepts a minimal profile as a VoiceProfile value without optional fields", () => {
    const profile: import("./voice-profile.js").VoiceProfile = {
      id: "bare-minimum",
      name: "Bare Minimum",
      description: "Just the required fields.",
    };
    expect(voiceProfileSchema.safeParse(profile).success).toBe(true);
  });
});
