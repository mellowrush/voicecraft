export class RateLimitError extends Error {
  retryAfterMs?: number;

  constructor(message?: string, options?: { retryAfterMs?: number }) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterMs = options?.retryAfterMs;
  }
}

export type EngineError = {
  code: "invalid_request" | "provider_error" | "rate_limited" | "aborted" | "unknown";
  cause?: unknown;
  retryAfterMs?: number;
};
