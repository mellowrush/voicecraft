import { describe, expect, it } from "vitest";
import { parseVariants } from "./parse-variants.js";

describe("parseVariants", () => {
  it("returns the whole trimmed text as one variant when requestedCount is 1", () => {
    expect(parseVariants("  hello world  ", 1)).toEqual(["hello world"]);
  });

  it("parses a clean {\"variants\": [...]} JSON object", () => {
    const raw = '{"variants": ["one", "two", "three"]}';
    expect(parseVariants(raw, 3)).toEqual(["one", "two", "three"]);
  });

  it("extracts JSON wrapped in prose or a code fence", () => {
    const raw = 'Sure, here you go:\n```json\n{"variants": ["one", "two"]}\n```\nHope that helps!';
    expect(parseVariants(raw, 2)).toEqual(["one", "two"]);
  });

  it("returns fewer variants than requested when the model returns fewer (partial success, no error)", () => {
    const raw = '{"variants": ["only one"]}';
    expect(parseVariants(raw, 4)).toEqual(["only one"]);
  });

  it("drops empty-string entries from the parsed variants array", () => {
    const raw = '{"variants": ["one", "", "three"]}';
    expect(parseVariants(raw, 3)).toEqual(["one", "three"]);
  });

  it("falls back to the fixed delimiter when JSON parsing fails", () => {
    const raw = "First variant text\n===VARIANT===\nSecond variant text";
    expect(parseVariants(raw, 2)).toEqual(["First variant text", "Second variant text"]);
  });

  it("falls back to treating the whole response as one variant when neither JSON nor delimiter parse", () => {
    const raw = "Just some plain prose the model returned with no structure at all.";
    expect(parseVariants(raw, 3)).toEqual([raw]);
  });

  it("never throws on malformed JSON", () => {
    const raw = '{"variants": [invalid json here';
    expect(() => parseVariants(raw, 2)).not.toThrow();
    expect(parseVariants(raw, 2)).toEqual([raw]);
  });
});
