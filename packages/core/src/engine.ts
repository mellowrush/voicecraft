import { z } from "zod";
import { buildPrompt } from "./prompt.js";
import { voiceProfileSchema, type VoiceProfile } from "./voice-profile.js";
import { generationOptionsSchema, type GenerationOptions } from "./generation-options.js";
import type { Mode } from "./mode.js";
import { RateLimitError, type EngineError } from "./errors.js";
import { parseVariants } from "./parse-variants.js";
import { canSafelyStripDiacritics, stripDiacritics } from "./diacritics.js";

export type Provider = (
  prompt: string,
  opts: { stream?: boolean; signal?: AbortSignal },
) => Promise<{ text: string }> | AsyncIterable<{ delta: string }>;

export interface Engine {
  generate(
    request: {
      profile: VoiceProfile;
      text: string;
      mode: Mode;
      context?: string;
      options?: GenerationOptions;
    },
    opts?: { stream?: boolean; signal?: AbortSignal },
  ): Promise<{ variants: string[] }> | AsyncIterable<{ delta: string }>;
}

type SignalOpts = { signal?: AbortSignal };

const requestSchema = z
  .object({
    profile: voiceProfileSchema,
    text: z.string().min(1),
    mode: z.enum(["rewrite", "generate"] satisfies [Mode, Mode]),
    context: z.string().optional(),
    options: generationOptionsSchema.optional(),
  })
  .strict();

// Marks objects we constructed ourselves as EngineErrors, so a provider-thrown
// object that merely happens to carry an unrelated `.code` property (e.g. a
// Node network error) isn't mistaken for one and passed through unnormalized.
const engineErrorTag = Symbol("engineError");

function makeEngineError(err: EngineError): EngineError {
  return Object.assign(err, { [engineErrorTag]: true });
}

function isEngineError(err: unknown): err is EngineError {
  return typeof err === "object" && err !== null && engineErrorTag in err;
}

function normalizeError(err: unknown): EngineError {
  if (isEngineError(err)) {
    return err;
  }
  if (err instanceof RateLimitError) {
    return { code: "rate_limited", cause: err, retryAfterMs: err.retryAfterMs };
  }
  if (err instanceof Error) {
    return { code: "provider_error", cause: err };
  }
  return { code: "unknown", cause: err };
}

function checkAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw makeEngineError({ code: "aborted" });
  }
}

function raceWithAbort<T>(promise: Promise<T>, { signal }: SignalOpts): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(makeEngineError({ code: "aborted" }));

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(makeEngineError({ code: "aborted" }));
    };
    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

function batchGenerate(provider: Provider, prompt: string, opts: SignalOpts): Promise<{ text: string }> {
  let providerResult: Promise<{ text: string }>;
  try {
    providerResult = Promise.resolve(
      provider(prompt, { stream: false, signal: opts.signal }) as Promise<{ text: string }>,
    );
  } catch (err) {
    return Promise.reject(normalizeError(err));
  }

  return raceWithAbort(providerResult, opts).catch((err) => {
    throw normalizeError(err);
  });
}

async function* streamGenerate(
  provider: Provider,
  prompt: string,
  opts: SignalOpts,
): AsyncGenerator<{ delta: string }> {
  let source: AsyncIterable<{ delta: string }>;
  try {
    source = provider(prompt, { stream: true, signal: opts.signal }) as AsyncIterable<{
      delta: string;
    }>;
  } catch (err) {
    throw normalizeError(err);
  }

  const iterator = source[Symbol.asyncIterator]();

  try {
    while (true) {
      const next = await raceWithAbort(iterator.next(), opts);
      if (next.done) return;
      checkAborted(opts.signal);
      yield next.value;
    }
  } catch (err) {
    throw normalizeError(err);
  }
}

function applyDiacritics(variants: string[], options?: GenerationOptions): string[] {
  if (options?.diacritics !== "strip" || !canSafelyStripDiacritics(options.language)) {
    return variants;
  }
  return variants.map(stripDiacritics);
}

export function createEngine(config: { provider: Provider }): Engine {
  return {
    generate(request, opts) {
      const parsed = requestSchema.safeParse(request);
      if (!parsed.success) {
        throw makeEngineError({ code: "invalid_request", cause: parsed.error });
      }
      checkAborted(opts?.signal);

      const prompt = buildPrompt(parsed.data);
      const variantCount = parsed.data.options?.variantCount ?? 1;

      // No vendor supports incrementally parsing a multi-variant JSON payload
      // mid-stream (ADR-0007), so a variantCount > 1 always forces a batch
      // call, silently overriding opts.stream — the caller shouldn't need to
      // know this constraint exists just to pass a profile's defaults through.
      if (opts?.stream && variantCount <= 1) {
        return streamGenerate(config.provider, prompt, opts);
      }

      return batchGenerate(config.provider, prompt, opts ?? {}).then(({ text }) => ({
        variants: applyDiacritics(parseVariants(text, variantCount), parsed.data.options),
      }));
    },
  };
}
