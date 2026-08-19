import { describe, expect, it, vi } from "vitest";
import { RateLimitError } from "@voicecraft/core";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const { tauriProvider, parseProviderCallError } = await import("./providerClient");

describe("tauriProvider", () => {
  it("calls the call_provider Tauri command and returns the text", async () => {
    vi.mocked(invoke).mockResolvedValue("rewritten text");

    const result = await tauriProvider("some prompt", {});

    expect(invoke).toHaveBeenCalledWith("call_provider", { prompt: "some prompt" });
    expect(result).toEqual({ text: "rewritten text" });
  });

  it("normalizes a rate_limited rejection into a RateLimitError", async () => {
    vi.mocked(invoke).mockRejectedValue({ kind: "rate_limited", message: "slow down", retryAfterMs: 2000 });

    await expect(tauriProvider("prompt", {})).rejects.toBeInstanceOf(RateLimitError);
    await expect(tauriProvider("prompt", {})).rejects.toMatchObject({ retryAfterMs: 2000 });
  });

  it("normalizes a provider_error rejection into a plain Error", async () => {
    vi.mocked(invoke).mockRejectedValue({ kind: "provider_error", message: "bad key" });

    await expect(tauriProvider("prompt", {})).rejects.toThrow("bad key");
  });

  it("normalizes an unrecognized rejection shape into a fallback Error", async () => {
    vi.mocked(invoke).mockRejectedValue("boom");

    await expect(tauriProvider("prompt", {})).rejects.toThrow("boom");
  });
});

describe("parseProviderCallError", () => {
  it("falls back to provider_error for shapes it doesn't recognize", () => {
    expect(parseProviderCallError(null)).toEqual({ kind: "provider_error", message: "Unknown provider error" });
  });
});
