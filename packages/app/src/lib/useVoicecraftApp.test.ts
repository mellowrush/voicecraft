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
    const generate = vi.fn().mockResolvedValue({ text: "rewritten!" });
    const engine = makeEngine(generate);

    const { result } = renderHook(() => useVoicecraftApp({ engine, readFile, writeFile }));
    await waitFor(() => expect(result.current.profiles.length).toBeGreaterThan(0));

    act(() => result.current.setInputText("hello there"));
    await act(() => result.current.runAction());

    expect(result.current.run).toEqual({ status: "success", text: "rewritten!" });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ text: "hello there", mode: "rewrite" }),
      { stream: false },
    );
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
});
