import { describe, expect, it } from "vitest";
import { wordDiff } from "./diff";

describe("wordDiff", () => {
  it("returns a single same segment for identical text", () => {
    expect(wordDiff("hello world", "hello world")).toEqual([{ type: "same", text: "hello world" }]);
  });

  it("marks purely added words", () => {
    expect(wordDiff("hello", "hello world")).toEqual([
      { type: "same", text: "hello" },
      { type: "add", text: " world" },
    ]);
  });

  it("marks purely removed words", () => {
    expect(wordDiff("hello world", "hello")).toEqual([
      { type: "same", text: "hello" },
      { type: "del", text: " world" },
    ]);
  });

  it("marks a mixed replacement", () => {
    expect(wordDiff("hey there friend", "hi there buddy")).toEqual([
      { type: "del", text: "hey" },
      { type: "add", text: "hi" },
      { type: "same", text: " there " },
      { type: "del", text: "friend" },
      { type: "add", text: "buddy" },
    ]);
  });

  it("handles empty strings", () => {
    expect(wordDiff("", "")).toEqual([]);
    expect(wordDiff("", "new text")).toEqual([{ type: "add", text: "new text" }]);
  });

  it("falls back to a whole-block diff above the LCS size guard, instead of freezing", () => {
    const before = "word ".repeat(3000);
    const after = "different ".repeat(3000);

    expect(wordDiff(before, after)).toEqual([
      { type: "del", text: before },
      { type: "add", text: after },
    ]);
  });
});
