import { describe, expect, it, vi } from "vitest";
import { loadProfiles, parseProfilesFile, saveProfiles, serializeProfiles } from "./profileStore";
import { predefinedProfiles } from "./predefinedProfiles";
import type { VoiceProfile } from "@voicecraft/core";

const customProfile: VoiceProfile = {
  id: "my-cofounder-voice",
  name: "My Cofounder Voice",
  description: "How Alex writes Slack messages.",
};

describe("parseProfilesFile", () => {
  it("returns an empty array for an empty/missing file", () => {
    expect(parseProfilesFile("")).toEqual([]);
    expect(parseProfilesFile("   ")).toEqual([]);
  });

  it("returns an empty array for invalid JSON", () => {
    expect(parseProfilesFile("{not json")).toEqual([]);
  });

  it("returns an empty array when the JSON isn't an array", () => {
    expect(parseProfilesFile(JSON.stringify({ foo: "bar" }))).toEqual([]);
  });

  it("round-trips valid profiles through voiceProfileSchema", () => {
    const raw = serializeProfiles([customProfile]);
    expect(parseProfilesFile(raw)).toEqual([customProfile]);
  });

  it("drops invalid entries but keeps valid ones", () => {
    const raw = JSON.stringify([customProfile, { id: "bad" /* missing name/description */ }]);
    expect(parseProfilesFile(raw)).toEqual([customProfile]);
  });
});

describe("loadProfiles", () => {
  it("seeds predefined profiles when the store is empty", async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const profiles = await loadProfiles(async () => "", writeFile);

    expect(profiles).toEqual(predefinedProfiles);
    expect(writeFile).toHaveBeenCalledWith(serializeProfiles(predefinedProfiles));
  });

  it("returns stored profiles without reseeding when the store is non-empty", async () => {
    const writeFile = vi.fn();
    const profiles = await loadProfiles(async () => serializeProfiles([customProfile]), writeFile);

    expect(profiles).toEqual([customProfile]);
    expect(writeFile).not.toHaveBeenCalled();
  });
});

describe("saveProfiles", () => {
  it("serializes profiles and writes them out", async () => {
    const writeFile = vi.fn().mockResolvedValue(undefined);
    await saveProfiles([customProfile], writeFile);

    expect(writeFile).toHaveBeenCalledWith(serializeProfiles([customProfile]));
  });
});
