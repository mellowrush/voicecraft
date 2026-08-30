// The two AI vendors Voicecraft's Settings UI lets a user pick between (#42).
// Deliberately not pluggable/arbitrary — see issue #42's "Out of scope".
export type Vendor = "openai" | "anthropic";

export const DEFAULT_VENDOR: Vendor = "openai";

export function isVendor(value: unknown): value is Vendor {
  return value === "openai" || value === "anthropic";
}

export function vendorLabel(vendor: Vendor): string {
  return vendor === "openai" ? "OpenAI" : "Anthropic";
}
