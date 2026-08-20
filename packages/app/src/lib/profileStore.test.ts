import { describe, expect, it, vi } from "vitest";
import { loadProfiles, parseProfilesFile, serializeProfilesFile } from "./profileStore";
import { predefinedProfiles } from "./predefinedProfiles";
import type { VoiceProfile } from "@voicecraft/core";

const customProfile: VoiceProfile = {
  id: "my-cofounder-voice",
  name: "My Cofounder Voice",
  description: "How Alex writes Slack messages.",
};

describe("parseProfilesFile", () => {
  it("returns an empty store for an empty/missing file", () => {
    expect(parseProfilesFile("")).toEqual({ profiles: [], lastUsedProfileId: null });
    expect(parseProfilesFile("   ")).toEqual({ profiles: [], lastUsedProfileId: null });
  });

  it("returns an empty store for invalid JSON", () => {
    expect(parseProfilesFile("{not json")).toEqual({ profiles: [], lastUsedProfileId: null });
  });

  it("returns an empty store when the JSON is neither an array nor an object", () => {
    expect(parseProfilesFile("42")).toEqual({ profiles: [], lastUsedProfileId: null });
  });

  it("round-trips valid profiles and lastUsedProfileId through voiceProfileSchema", () => {
    const raw = serializeProfilesFile({ profiles: [customProfile], lastUsedProfileId: customProfile.id });
    expect(parseProfilesFile(raw)).toEqual({ profiles: [customProfile], lastUsedProfileId: customProfile.id });
  });

  it("drops invalid entries but keeps valid ones", () => {
    const raw = JSON.stringify({
      profiles: [customProfile, { id: "bad" /* missing name/description */ }],
      lastUsedProfileId: null,
    });
    expect(parseProfilesFile(raw)).toEqual({ profiles: [customProfile], lastUsedProfileId: null });
  });

  it("reads the pre-#21 bare-array file format, with no last-used profile", () => {
    expect(parseProfilesFile(JSON.stringify([customProfile]))).toEqual({
      profiles: [customProfile],
      lastUsedProfileId: null,
    });
  });
});

describe("loadProfiles", () => {
  it("seeds predefined profiles when the store is empty", async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const store = await loadProfiles(async () => "", writeFile);

    expect(store).toEqual({ profiles: predefinedProfiles, lastUsedProfileId: null });
    expect(writeFile).toHaveBeenCalledWith(
      serializeProfilesFile({ profiles: predefinedProfiles, lastUsedProfileId: null }),
    );
  });

  it("returns the stored profile store without reseeding when non-empty", async () => {
    const writeFile = vi.fn();
    const raw = serializeProfilesFile({ profiles: [customProfile], lastUsedProfileId: customProfile.id });
    const store = await loadProfiles(async () => raw, writeFile);

    expect(store).toEqual({ profiles: [customProfile], lastUsedProfileId: customProfile.id });
    expect(writeFile).not.toHaveBeenCalled();
  });
});
