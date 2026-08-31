import type { EngineError } from "@voicecraft/core";

export function engineErrorMessage(error: EngineError): string {
  switch (error.code) {
    case "invalid_request":
      return "That request wasn't valid — check the text and try again.";
    case "rate_limited":
      return error.retryAfterMs
        ? `Rate limited — try again in ${Math.ceil(error.retryAfterMs / 1000)}s.`
        : "Rate limited — try again in a moment.";
    case "provider_error": {
      const detail = error.cause instanceof Error ? error.cause.message : undefined;
      return detail ? `The AI provider returned an error: ${detail}` : "The AI provider returned an error. Try again.";
    }
    case "aborted":
      return "Cancelled.";
    case "unknown":
    default:
      return "Something went wrong. Try again.";
  }
}
