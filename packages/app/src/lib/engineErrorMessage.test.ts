import { describe, expect, it } from "vitest";
import { engineErrorMessage } from "./engineErrorMessage";

describe("engineErrorMessage", () => {
  it("shows a retry hint with seconds when rate_limited carries retryAfterMs", () => {
    expect(engineErrorMessage({ code: "rate_limited", retryAfterMs: 4500 })).toBe(
      "Rate limited — try again in 5s.",
    );
  });

  it("shows a generic retry hint when rate_limited has no retryAfterMs", () => {
    expect(engineErrorMessage({ code: "rate_limited" })).toBe("Rate limited — try again in a moment.");
  });

  it("has a distinct message per error code", () => {
    const codes = ["invalid_request", "provider_error", "aborted", "unknown"] as const;
    const messages = codes.map((code) => engineErrorMessage({ code }));
    expect(new Set(messages).size).toBe(codes.length);
  });
});
