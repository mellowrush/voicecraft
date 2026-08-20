import { describe, expect, it } from "vitest";
import { pickHudProfile } from "./hudProfile";
import { predefinedProfiles } from "./predefinedProfiles";

describe("pickHudProfile", () => {
  it("picks the profile matching the given id", () => {
    expect(pickHudProfile(predefinedProfiles, predefinedProfiles[1].id)).toEqual(predefinedProfiles[1]);
  });

  it("falls back to the first profile when the id is null", () => {
    expect(pickHudProfile(predefinedProfiles, null)).toEqual(predefinedProfiles[0]);
  });

  it("falls back to the first profile when the id doesn't match any profile", () => {
    expect(pickHudProfile(predefinedProfiles, "unknown-id")).toEqual(predefinedProfiles[0]);
  });

  it("returns null when there are no profiles at all", () => {
    expect(pickHudProfile([], "unknown-id")).toBeNull();
  });
});
