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
    expect(parseProfilesFile("")).toEqual({ profiles: [], lastUsedProfileId: null, activeVendor: "openai" });
    expect(parseProfilesFile("   ")).toEqual({ profiles: [], lastUsedProfileId: null, activeVendor: "openai" });
  });

  it("returns an empty store for invalid JSON", () => {
    expect(parseProfilesFile("{not json")).toEqual({ profiles: [], lastUsedProfileId: null, activeVendor: "openai" });
  });

  it("returns an empty store when the JSON is neither an array nor an object", () => {
    expect(parseProfilesFile("42")).toEqual({ profiles: [], lastUsedProfileId: null, activeVendor: "openai" });
  });

  it("round-trips valid profiles, lastUsedProfileId and activeVendor through voiceProfileSchema", () => {
    const raw = serializeProfilesFile({
      profiles: [customProfile],
      lastUsedProfileId: customProfile.id,
      activeVendor: "anthropic",
    });
    expect(parseProfilesFile(raw)).toEqual({
      profiles: [customProfile],
      lastUsedProfileId: customProfile.id,
      activeVendor: "anthropic",
    });
  });

  it("falls back to the default vendor for a missing or invalid activeVendor", () => {
    const raw = JSON.stringify({ profiles: [customProfile], lastUsedProfileId: null, activeVendor: "not-a-vendor" });
    expect(parseProfilesFile(raw).activeVendor).toBe("openai");
  });

  it("drops invalid entries but keeps valid ones", () => {
    const raw = JSON.stringify({
      profiles: [customProfile, { id: "bad" /* missing name/description */ }],
      lastUsedProfileId: null,
    });
    expect(parseProfilesFile(raw)).toEqual({ profiles: [customProfile], lastUsedProfileId: null, activeVendor: "openai" });
  });

  it("reads the pre-#21 bare-array file format, with no last-used profile or vendor", () => {
    expect(parseProfilesFile(JSON.stringify([customProfile]))).toEqual({
      profiles: [customProfile],
      lastUsedProfileId: null,
      activeVendor: "openai",
    });
  });
});

describe("loadProfiles", () => {
  it("seeds predefined profiles when the store is empty", async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const store = await loadProfiles(async () => "", writeFile);

    expect(store).toEqual({ profiles: predefinedProfiles, lastUsedProfileId: null, activeVendor: "openai" });
    expect(writeFile).toHaveBeenCalledWith(
      serializeProfilesFile({ profiles: predefinedProfiles, lastUsedProfileId: null, activeVendor: "openai" }),
    );
  });

  it("returns the stored profile store without reseeding when non-empty", async () => {
    const writeFile = vi.fn();
    const raw = serializeProfilesFile({
      profiles: [customProfile],
      lastUsedProfileId: customProfile.id,
      activeVendor: "anthropic",
    });
    const store = await loadProfiles(async () => raw, writeFile);

    expect(store).toEqual({ profiles: [customProfile], lastUsedProfileId: customProfile.id, activeVendor: "anthropic" });
    expect(writeFile).not.toHaveBeenCalled();
  });
});
