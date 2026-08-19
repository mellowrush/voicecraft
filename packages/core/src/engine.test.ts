import { describe, expect, it, vi } from "vitest";
import { createEngine } from "./engine.js";
import { RateLimitError } from "./errors.js";
import { bareMinimum } from "./test-fixtures.js";

function baseRequest(overrides: Partial<Parameters<ReturnType<typeof createEngine>["generate"]>[0]> = {}) {
  return {
    profile: bareMinimum,
    text: "hello world",
    mode: "generate" as const,
    ...overrides,
  };
}

describe("createEngine", () => {
  it("rejects an invalid request without calling the provider", () => {
    const provider = vi.fn();
    const engine = createEngine({ provider });

    expect(() =>
      engine.generate({ ...baseRequest(), mode: "sideways" } as never),
    ).toThrow(expect.objectContaining({ code: "invalid_request" }));
    expect(provider).not.toHaveBeenCalled();
  });

  it("passes only the finished prompt string to the provider, never the raw profile", async () => {
    const provider = vi.fn(async (prompt: string) => {
      expect(typeof prompt).toBe("string");
      expect(prompt).toContain("Bare Minimum");
      return { text: "ok" };
    });
    const engine = createEngine({ provider });

    await engine.generate(baseRequest());

    expect(provider).toHaveBeenCalledTimes(1);
    const [promptArg] = provider.mock.calls[0]!;
    expect(typeof promptArg).toBe("string");
  });

  it("resolves { text } for a batch call", async () => {
    const provider = vi.fn(async () => ({ text: "the response" }));
    const engine = createEngine({ provider });

    const result = await engine.generate(baseRequest());

    expect(result).toEqual({ text: "the response" });
  });

  it("resolves an AsyncIterable<{ delta }> for a streaming call", async () => {
    const provider = vi.fn(async function* () {
      yield { delta: "hel" };
      yield { delta: "lo" };
    });
    const engine = createEngine({ provider });

    const stream = engine.generate(baseRequest(), { stream: true }) as AsyncIterable<{
      delta: string;
    }>;

    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk.delta);
    }

    expect(chunks.join("")).toBe("hello");
  });

  it("normalizes a plain Error thrown by the provider to provider_error", async () => {
    const provider = vi.fn(async () => {
      throw new Error("boom");
    });
    const engine = createEngine({ provider });

    await expect(engine.generate(baseRequest())).rejects.toMatchObject({
      code: "provider_error",
    });
  });

  it("normalizes a non-Error throw from the provider to unknown", async () => {
    const provider = vi.fn(async () => {
      throw "not an error";
    });
    const engine = createEngine({ provider });

    await expect(engine.generate(baseRequest())).rejects.toMatchObject({
      code: "unknown",
    });
  });

  it("normalizes a plain Error with an unrelated .code property, instead of passing it through", async () => {
    const nodeStyleError = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    const provider = vi.fn(async () => {
      throw nodeStyleError;
    });
    const engine = createEngine({ provider });

    await expect(engine.generate(baseRequest())).rejects.toMatchObject({
      code: "provider_error",
      cause: nodeStyleError,
    });
  });

  it("normalizes a RateLimitError to rate_limited, carrying retryAfterMs through", async () => {
    const provider = vi.fn(async () => {
      throw new RateLimitError("slow down", { retryAfterMs: 1500 });
    });
    const engine = createEngine({ provider });

    await expect(engine.generate(baseRequest())).rejects.toMatchObject({
      code: "rate_limited",
      retryAfterMs: 1500,
    });
  });

  it("rejects with code aborted when the signal is already aborted, without calling the provider", () => {
    const provider = vi.fn();
    const engine = createEngine({ provider });
    const controller = new AbortController();
    controller.abort();

    expect(() => engine.generate(baseRequest(), { signal: controller.signal })).toThrow(
      expect.objectContaining({ code: "aborted" }),
    );
    expect(provider).not.toHaveBeenCalled();
  });

  it("rejects a batch call with code aborted when aborted mid-call", async () => {
    const provider = vi.fn(
      () =>
        new Promise<{ text: string }>((resolve) => {
          setTimeout(() => resolve({ text: "too late" }), 50);
        }),
    );
    const engine = createEngine({ provider });
    const controller = new AbortController();

    const promise = engine.generate(baseRequest(), { signal: controller.signal });
    setTimeout(() => controller.abort(), 10);

    await expect(promise).rejects.toMatchObject({ code: "aborted" });
  });

  it("throws code aborted from a streaming call when aborted mid-iteration", async () => {
    const provider = vi.fn(async function* () {
      yield { delta: "first" };
      await new Promise((resolve) => setTimeout(resolve, 50));
      yield { delta: "second" };
    });
    const engine = createEngine({ provider });
    const controller = new AbortController();

    const stream = engine.generate(baseRequest(), {
      stream: true,
      signal: controller.signal,
    }) as AsyncIterable<{ delta: string }>;

    async function consume() {
      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk.delta);
        if (chunks.length === 1) {
          controller.abort();
        }
      }
      return chunks;
    }

    await expect(consume()).rejects.toMatchObject({ code: "aborted" });
  });

  it("rejects promptly with code aborted when the signal fires while a stalled stream is waiting for its next chunk", async () => {
    const provider = vi.fn(async function* () {
      yield { delta: "first" };
      await new Promise(() => {
        // never resolves: simulates a stream that stalls indefinitely
      });
      yield { delta: "unreachable" };
    });
    const engine = createEngine({ provider });
    const controller = new AbortController();

    const stream = engine.generate(baseRequest(), {
      stream: true,
      signal: controller.signal,
    }) as AsyncIterable<{ delta: string }>;

    async function consume() {
      const chunks: string[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk.delta);
        if (chunks.length === 1) {
          controller.abort();
        }
      }
      return chunks;
    }

    await expect(consume()).rejects.toMatchObject({ code: "aborted" });
  });
});
