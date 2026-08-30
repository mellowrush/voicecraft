import { describe, expect, it, vi, beforeEach } from "vitest";
import { RateLimitError } from "@voicecraft/core";
import { invoke } from "@tauri-apps/api/core";
import { serializeProfilesFile } from "./profileStore";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const { tauriProvider, parseProviderCallError } = await import("./providerClient");

describe("tauriProvider", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("calls call_provider with the active vendor read from the profiles file", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === "read_profiles_file") {
        return serializeProfilesFile({ profiles: [], lastUsedProfileId: null, activeVendor: "anthropic" });
      }
      if (cmd === "call_provider") return "rewritten text";
      throw new Error(`unexpected invoke: ${String(cmd)}`);
    });

    const result = await tauriProvider("some prompt", {});

    expect(invoke).toHaveBeenCalledWith("call_provider", { prompt: "some prompt", vendor: "anthropic" });
    expect(result).toEqual({ text: "rewritten text" });
  });

  it("normalizes a rate_limited rejection into a RateLimitError", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === "read_profiles_file") {
        return serializeProfilesFile({ profiles: [], lastUsedProfileId: null, activeVendor: "openai" });
      }
      throw { kind: "rate_limited", message: "slow down", retryAfterMs: 2000 };
    });

    await expect(tauriProvider("prompt", {})).rejects.toBeInstanceOf(RateLimitError);
    await expect(tauriProvider("prompt", {})).rejects.toMatchObject({ retryAfterMs: 2000 });
  });

  it("normalizes a provider_error rejection into a plain Error", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === "read_profiles_file") {
        return serializeProfilesFile({ profiles: [], lastUsedProfileId: null, activeVendor: "openai" });
      }
      throw { kind: "provider_error", message: "bad key" };
    });

    await expect(tauriProvider("prompt", {})).rejects.toThrow("bad key");
  });

  it("normalizes an unrecognized rejection shape into a fallback Error", async () => {
    vi.mocked(invoke).mockImplementation(async (cmd) => {
      if (cmd === "read_profiles_file") {
        return serializeProfilesFile({ profiles: [], lastUsedProfileId: null, activeVendor: "openai" });
      }
      throw "boom";
    });

    await expect(tauriProvider("prompt", {})).rejects.toThrow("boom");
  });
});

describe("parseProviderCallError", () => {
  it("falls back to provider_error for shapes it doesn't recognize", () => {
    expect(parseProviderCallError(null)).toEqual({ kind: "provider_error", message: "Unknown provider error" });
  });
});
