import { describe, expect, it } from "vitest";
import { parseHistoryFile, serializeHistoryEntry, type HistoryEntry } from "./historyStore";

const validEntry: HistoryEntry = {
  id: "1",
  createdAt: "2026-08-31T09:12:00.000Z",
  profileId: "roger-sterling",
  profileName: "Roger Sterling",
  vendor: "anthropic",
  mode: "rewrite",
  inputText: "We should consider the proposal.",
  variants: ["When the vendor pitched synergy, I nearly spilled my drink."],
};

describe("parseHistoryFile", () => {
  it("returns an empty array for an empty file", () => {
    expect(parseHistoryFile("")).toEqual([]);
  });

  it("parses one JSON object per line", () => {
    const raw = `${JSON.stringify(validEntry)}\n${JSON.stringify({ ...validEntry, id: "2" })}\n`;
    const entries = parseHistoryFile(raw);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual(validEntry);
    expect(entries[1].id).toBe("2");
  });

  it("drops a malformed JSON line rather than failing the whole file", () => {
    const raw = `${JSON.stringify(validEntry)}\nnot valid json at all\n${JSON.stringify({ ...validEntry, id: "3" })}\n`;
    const entries = parseHistoryFile(raw);
    expect(entries.map((e) => e.id)).toEqual(["1", "3"]);
  });

  it("drops a line missing a required field rather than failing the whole file", () => {
    const { variants: _variants, ...missingVariants } = validEntry;
    const raw = `${JSON.stringify(missingVariants)}\n${JSON.stringify(validEntry)}\n`;
    const entries = parseHistoryFile(raw);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe("1");
  });

  it("ignores blank lines", () => {
    const raw = `${JSON.stringify(validEntry)}\n\n\n`;
    expect(parseHistoryFile(raw)).toHaveLength(1);
  });
});

describe("serializeHistoryEntry", () => {
  it("produces a single-line JSON string with no embedded raw newlines", () => {
    const line = serializeHistoryEntry(validEntry);
    expect(line).not.toContain("\n");
    expect(JSON.parse(line)).toEqual(validEntry);
  });

  it("escapes newlines inside a variant's text rather than producing a literal newline", () => {
    const withNewline: HistoryEntry = { ...validEntry, variants: ["line one\nline two"] };
    const line = serializeHistoryEntry(withNewline);
    expect(line.split("\n")).toHaveLength(1);
    expect(JSON.parse(line).variants[0]).toBe("line one\nline two");
  });
});
