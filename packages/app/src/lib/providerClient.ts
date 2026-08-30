import { invoke } from "@tauri-apps/api/core";
import { RateLimitError, type Provider } from "@voicecraft/core";
import { readProfilesFile } from "./tauriProfileFile";
import { parseProfilesFile } from "./profileStore";

// Shape the Rust `call_provider` command rejects with (see src-tauri).
export type ProviderCallError =
  | { kind: "rate_limited"; message: string; retryAfterMs?: number }
  | { kind: "provider_error"; message: string };

export function parseProviderCallError(err: unknown): ProviderCallError {
  if (typeof err === "object" && err !== null && "kind" in err) {
    const record = err as Record<string, unknown>;
    if (record.kind === "rate_limited") {
      return {
        kind: "rate_limited",
        message: typeof record.message === "string" ? record.message : "Rate limited",
        retryAfterMs: typeof record.retryAfterMs === "number" ? record.retryAfterMs : undefined,
      };
    }
    if (record.kind === "provider_error" && typeof record.message === "string") {
      return { kind: "provider_error", message: record.message };
    }
  }
  return {
    kind: "provider_error",
    message: typeof err === "string" ? err : "Unknown provider error",
  };
}

export function toEngineFacingError(err: unknown): Error {
  const parsed = parseProviderCallError(err);
  if (parsed.kind === "rate_limited") {
    return new RateLimitError(parsed.message, { retryAfterMs: parsed.retryAfterMs });
  }
  return new Error(parsed.message);
}

// Satisfies core's `Provider` type by proxying the actual HTTP call through
// the Rust backend — the API key never enters this (webview) context. Reads
// the active vendor fresh from the shared profiles file (not React state)
// on every call, so it stays correct in the HUD's separate webview too
// (#42) without any cross-window state-syncing.
export const tauriProvider: Provider = async (prompt) => {
  try {
    const { activeVendor } = parseProfilesFile(await readProfilesFile());
    const text = await invoke<string>("call_provider", { prompt, vendor: activeVendor });
    return { text };
  } catch (err) {
    throw toEngineFacingError(err);
  }
};
