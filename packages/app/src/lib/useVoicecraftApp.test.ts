import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Engine } from "@voicecraft/core";
import { useVoicecraftApp } from "./useVoicecraftApp";
import { serializeProfilesFile } from "./profileStore";
import { predefinedProfiles } from "./predefinedProfiles";

function makeFileStore(initial = "") {
  let contents = initial;
  return {
    readFile: vi.fn(async () => contents),
    writeFile: vi.fn(async (next: string) => {
      contents = next;
    }),
  };
}

function seededStore(lastUsedProfileId: string | null = null, activeVendor: "openai" | "anthropic" = "openai") {
  return serializeProfilesFile({ profiles: predefinedProfiles, lastUsedProfileId, activeVendor });
}

function makeEngine(generate: Engine["generate"]): Engine {
  return { generate };
}

describe("useVoicecraftApp", () => {
  it("seeds and loads predefined profiles, selecting the first one", async () => {
    const { readFile, writeFile } = makeFileStore();
    const engine = makeEngine(vi.fn());

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));

    await waitFor(() => expect(result.current.profiles).toEqual(predefinedProfiles));
    expect(result.current.selectedProfileId).toBe(predefinedProfiles[0].id);
  });

  it("resumes the last-used profile from the store on load", async () => {
    const { readFile, writeFile } = makeFileStore(seededStore(predefinedProfiles[1].id));
    const engine = makeEngine(vi.fn());

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));

    await waitFor(() => expect(result.current.selectedProfileId).toBe(predefinedProfiles[1].id));
  });

  it("persists the last-used profile id into the same store when selection changes", async () => {
    const { readFile, writeFile } = makeFileStore(seededStore());
    const engine = makeEngine(vi.fn());

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
    await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

    act(() => result.current.setSelectedProfileId(predefinedProfiles[1].id));

    await waitFor(() =>
      expect(writeFile).toHaveBeenCalledWith(
        seededStore(predefinedProfiles[1].id),
      ),
    );
  });

  it("resumes the active vendor from the store on load", async () => {
    const { readFile, writeFile } = makeFileStore(seededStore(null, "anthropic"));
    const engine = makeEngine(vi.fn());

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));

    await waitFor(() => expect(result.current.activeVendor).toBe("anthropic"));
  });

  it("persists the active vendor into the same store when it changes", async () => {
    const { readFile, writeFile } = makeFileStore(seededStore());
    const engine = makeEngine(vi.fn());

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
    await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

    act(() => result.current.setActiveVendor("anthropic"));

    await waitFor(() =>
      expect(writeFile).toHaveBeenCalledWith(seededStore(result.current.selectedProfileId, "anthropic")),
    );
  });

  it("runs the engine and reports a success result", async () => {
    const { readFile, writeFile } = makeFileStore(seededStore());
    const generate = vi.fn().mockResolvedValue({ variants: ["rewritten!"] });
    const engine = makeEngine(generate);

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
    await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

    act(() => result.current.setInputText("hello there"));
    await act(() => result.current.runAction());

    expect(result.current.run).toEqual({ status: "success", variants: ["rewritten!"], requestedCount: 1 });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ text: "hello there", mode: "rewrite" }),
      { stream: false },
    );
  });

  it("passes the selected profile's defaultGenerationOptions through as options", async () => {
    const { readFile, writeFile } = makeFileStore(seededStore());
    const generate = vi.fn().mockResolvedValue({ variants: ["one", "two"] });
    const engine = makeEngine(generate);

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
    await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

    act(() => result.current.setInputText("hello there"));
    await act(() => result.current.runAction());

    const selectedProfile = result.current.profiles.find((p) => p.id === result.current.selectedProfileId);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ options: selectedProfile?.defaultGenerationOptions }),
      { stream: false },
    );
  });

  it("carries the profile's requested variantCount alongside a partial-success result", async () => {
    const profileWithVariants = { ...predefinedProfiles[0], defaultGenerationOptions: { variantCount: 4 } };
    const { readFile, writeFile } = makeFileStore(
      serializeProfilesFile({ profiles: [profileWithVariants], lastUsedProfileId: null, activeVendor: "openai" }),
    );
    const generate = vi.fn().mockResolvedValue({ variants: ["only one"] });
    const engine = makeEngine(generate);

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
    await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

    act(() => result.current.setInputText("hello there"));
    await act(() => result.current.runAction());

    expect(result.current.run).toEqual({ status: "success", variants: ["only one"], requestedCount: 4 });
  });

  it("maps an EngineError into a user-facing error message", async () => {
    const { readFile, writeFile } = makeFileStore(seededStore());
    const generate = vi.fn().mockRejectedValue({ code: "rate_limited", retryAfterMs: 3000 });
    const engine = makeEngine(generate);

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
    await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

    act(() => result.current.setInputText("hello there"));
    await act(() => result.current.runAction());

    expect(result.current.run).toEqual({ status: "error", message: "Rate limited — try again in 3s." });
  });

  it("does not run without input text", async () => {
    const { readFile, writeFile } = makeFileStore(seededStore());
    const generate = vi.fn();
    const engine = makeEngine(generate);

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
    await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

    await act(() => result.current.runAction());

    expect(generate).not.toHaveBeenCalled();
    expect(result.current.run).toEqual({ status: "idle" });
  });

  it("resets the view to result when switching to generate mode", async () => {
    const { readFile, writeFile } = makeFileStore(seededStore());
    const engine = makeEngine(vi.fn());

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
    await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

    act(() => result.current.setView("diff"));
    expect(result.current.view).toBe("diff");

    act(() => result.current.setMode("generate"));
    expect(result.current.view).toBe("result");
  });

  it("saves a new custom profile and persists it", async () => {
    const { readFile, writeFile } = makeFileStore(seededStore());
    const engine = makeEngine(vi.fn());

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
    await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

    await act(() => result.current.saveProfile({ name: "My Cofounder Voice", description: "Short, direct." }));

    expect(result.current.profiles).toContainEqual({
      id: "my-cofounder-voice",
      name: "My Cofounder Voice",
      description: "Short, direct.",
    });
    expect(result.current.selectedProfileId).toBe("my-cofounder-voice");
    expect(writeFile).toHaveBeenCalled();
  });

  it("disambiguates a new profile's id when it collides with an existing one", async () => {
    const { readFile, writeFile } = makeFileStore(seededStore());
    const engine = makeEngine(vi.fn());
    const collidingName = predefinedProfiles[0].name; // slugifies to the same id

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
    await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

    await act(() => result.current.saveProfile({ name: collidingName, description: "A different voice." }));

    expect(result.current.profiles).toHaveLength(predefinedProfiles.length + 1);
    expect(result.current.selectedProfileId).not.toBe(predefinedProfiles[0].id);
    expect(result.current.selectedProfile?.description).toBe("A different voice.");
  });

  it("edits an existing profile in place", async () => {
    const { readFile, writeFile } = makeFileStore(seededStore());
    const engine = makeEngine(vi.fn());
    const target = predefinedProfiles[0];

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
    await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

    await act(() =>
      result.current.saveProfile({ name: "Renamed", description: "New description" }, target.id),
    );

    expect(result.current.profiles.find((p) => p.id === target.id)).toEqual({
      id: target.id,
      name: "Renamed",
      description: "New description",
    });
    expect(result.current.profiles).toHaveLength(predefinedProfiles.length);
  });

  it("saves a profile's defaultGenerationOptions alongside name/description", async () => {
    const { readFile, writeFile } = makeFileStore(seededStore());
    const engine = makeEngine(vi.fn());

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
    await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

    await act(() =>
      result.current.saveProfile({
        name: "Multilingual Voice",
        description: "Speaks several languages.",
        defaultGenerationOptions: { variantCount: 3, language: "ro" },
      }),
    );

    expect(result.current.profiles).toContainEqual({
      id: "multilingual-voice",
      name: "Multilingual Voice",
      description: "Speaks several languages.",
      defaultGenerationOptions: { variantCount: 3, language: "ro" },
    });
  });

  describe("session-level generation-options overrides", () => {
    it("has no override by default, so runAction sends the profile's own defaults", async () => {
      const profileWithDefaults = { ...predefinedProfiles[0], defaultGenerationOptions: { variantCount: 2 } };
      const { readFile, writeFile } = makeFileStore(
        serializeProfilesFile({ profiles: [profileWithDefaults], lastUsedProfileId: null, activeVendor: "openai" }),
      );
      const generate = vi.fn().mockResolvedValue({ variants: ["one", "two"] });
      const engine = makeEngine(generate);

      const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
      await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));
      expect(result.current.optionsOverride).toBeUndefined();

      act(() => result.current.setInputText("hello there"));
      await act(() => result.current.runAction());

      expect(generate).toHaveBeenCalledWith(
        expect.objectContaining({ options: { variantCount: 2 } }),
        { stream: false },
      );
    });

    it("sends the override instead of the profile's defaults once one is set", async () => {
      const profileWithDefaults = { ...predefinedProfiles[0], defaultGenerationOptions: { variantCount: 2 } };
      const { readFile, writeFile } = makeFileStore(
        serializeProfilesFile({ profiles: [profileWithDefaults], lastUsedProfileId: null, activeVendor: "openai" }),
      );
      const generate = vi.fn().mockResolvedValue({ variants: ["one", "two", "three"] });
      const engine = makeEngine(generate);

      const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
      await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

      act(() => result.current.setOptionsOverride({ variantCount: 5 }));
      act(() => result.current.setInputText("hello there"));
      await act(() => result.current.runAction());

      expect(generate).toHaveBeenCalledWith(
        expect.objectContaining({ options: { variantCount: 5 } }),
        { stream: false },
      );
    });

    it("clears the override when the selected profile changes", async () => {
      const { readFile, writeFile } = makeFileStore(seededStore());
      const engine = makeEngine(vi.fn());

      const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
      await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

      act(() => result.current.setOptionsOverride({ variantCount: 5 }));
      expect(result.current.optionsOverride).toEqual({ variantCount: 5 });

      act(() => result.current.setSelectedProfileId(predefinedProfiles[1].id));

      expect(result.current.optionsOverride).toBeUndefined();
    });
  });
});
