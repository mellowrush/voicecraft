import { describe, expect, it } from "vitest";
import { voiceProfileSchema } from "./voice-profile.js";
import { bareMinimum, encouragingCoach, noirDetective } from "./test-fixtures.js";

describe("voiceProfileSchema", () => {
  it("accepts a full profile with every optional field populated", () => {
    expect(voiceProfileSchema.safeParse(noirDetective).success).toBe(true);
    expect(voiceProfileSchema.safeParse(encouragingCoach).success).toBe(true);
  });

  it("accepts a minimal profile with only id/name/description", () => {
    expect(voiceProfileSchema.safeParse(bareMinimum).success).toBe(true);
  });

  it("rejects a profile missing a required field", () => {
    const { name, ...missingName } = bareMinimum;
    expect(voiceProfileSchema.safeParse(missingName).success).toBe(false);
  });

  it("rejects a profile with a wrong field type", () => {
    const wrongType = { ...bareMinimum, tags: "not-an-array" };
    expect(voiceProfileSchema.safeParse(wrongType).success).toBe(false);
  });

  it("rejects a profile with an unexpected extra key", () => {
    const extraKey = { ...bareMinimum, source: "predefined" };
    expect(voiceProfileSchema.safeParse(extraKey).success).toBe(false);
  });

  it("rejects an unexpected extra key on a nested example", () => {
    const extraExampleKey = {
      ...bareMinimum,
      examples: [{ input: "a", output: "b", source: "predefined" }],
    };
    expect(voiceProfileSchema.safeParse(extraExampleKey).success).toBe(false);
  });

  it("rejects an empty id", () => {
    expect(voiceProfileSchema.safeParse({ ...bareMinimum, id: "" }).success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(voiceProfileSchema.safeParse({ ...bareMinimum, name: "" }).success).toBe(false);
  });

  it("rejects an empty description", () => {
    expect(voiceProfileSchema.safeParse({ ...bareMinimum, description: "" }).success).toBe(
      false,
    );
  });

  it("rejects an example with an empty input or output", () => {
    expect(
      voiceProfileSchema.safeParse({
        ...bareMinimum,
        examples: [{ input: "", output: "b" }],
      }).success,
    ).toBe(false);
    expect(
      voiceProfileSchema.safeParse({
        ...bareMinimum,
        examples: [{ input: "a", output: "" }],
      }).success,
    ).toBe(false);
  });

  it("accepts a minimal profile as a VoiceProfile value without optional fields", () => {
    expect(voiceProfileSchema.safeParse(bareMinimum).success).toBe(true);
  });

  describe("defaultGenerationOptions", () => {
    it("accepts a profile with a fully populated defaultGenerationOptions", () => {
      const profile = {
        ...bareMinimum,
        defaultGenerationOptions: { targetLength: 120, variantCount: 3, language: "ro", diacritics: "strip" },
      };
      expect(voiceProfileSchema.safeParse(profile).success).toBe(true);
    });

    it("accepts a profile without defaultGenerationOptions", () => {
      expect(voiceProfileSchema.safeParse(bareMinimum).success).toBe(true);
    });

    it("rejects a variantCount below 1", () => {
      const profile = { ...bareMinimum, defaultGenerationOptions: { variantCount: 0 } };
      expect(voiceProfileSchema.safeParse(profile).success).toBe(false);
    });

    it("rejects a variantCount above 6", () => {
      const profile = { ...bareMinimum, defaultGenerationOptions: { variantCount: 7 } };
      expect(voiceProfileSchema.safeParse(profile).success).toBe(false);
    });

    it("rejects a non-integer variantCount", () => {
      const profile = { ...bareMinimum, defaultGenerationOptions: { variantCount: 2.5 } };
      expect(voiceProfileSchema.safeParse(profile).success).toBe(false);
    });

    it("rejects a diacritics value outside the enum", () => {
      const profile = { ...bareMinimum, defaultGenerationOptions: { diacritics: "force" } };
      expect(voiceProfileSchema.safeParse(profile).success).toBe(false);
    });

    it("rejects an unexpected extra key inside defaultGenerationOptions", () => {
      const profile = { ...bareMinimum, defaultGenerationOptions: { unknownField: true } };
      expect(voiceProfileSchema.safeParse(profile).success).toBe(false);
    });

    it("rejects a top-level language field now that it has moved into defaultGenerationOptions", () => {
      const profile = { ...bareMinimum, language: "en" };
      expect(voiceProfileSchema.safeParse(profile).success).toBe(false);
    });
  });
});
