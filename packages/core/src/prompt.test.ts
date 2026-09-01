import { describe, expect, it } from "vitest";
import { buildPrompt } from "./prompt.js";
import { bareMinimum, noirDetective } from "./test-fixtures.js";

describe("buildPrompt", () => {
  it("includes every section in order for a full profile, rewrite mode, no context", () => {
    const prompt = buildPrompt({
      profile: noirDetective,
      mode: "rewrite",
      text: "The meeting got rescheduled to tomorrow.",
      options: { language: "en" },
    });

    const nameIdx = prompt.indexOf('You are writing in the voice of "Noir Detective".');
    const descriptionIdx = prompt.indexOf(noirDetective.description);
    const styleIdx = prompt.indexOf("Style: cynical, terse, period.");
    const rulesIdx = prompt.indexOf("Rules you must follow:");
    const examplesIdx = prompt.indexOf("Examples of this voice in action:");
    const languageIdx = prompt.indexOf("Respond in en.");
    const instructionIdx = prompt.indexOf(
      "Rewrite the following text in this voice. Preserve its meaning and intent, but fully commit to the voice above.",
    );
    const textIdx = prompt.indexOf(
      "Text to rewrite:\nThe meeting got rescheduled to tomorrow.",
    );

    for (const idx of [
      nameIdx,
      descriptionIdx,
      styleIdx,
      rulesIdx,
      examplesIdx,
      languageIdx,
      instructionIdx,
      textIdx,
    ]) {
      expect(idx).toBeGreaterThan(-1);
    }

    expect(nameIdx).toBeLessThan(descriptionIdx);
    expect(descriptionIdx).toBeLessThan(styleIdx);
    expect(styleIdx).toBeLessThan(rulesIdx);
    expect(rulesIdx).toBeLessThan(examplesIdx);
    expect(examplesIdx).toBeLessThan(languageIdx);
    expect(languageIdx).toBeLessThan(instructionIdx);
    expect(instructionIdx).toBeLessThan(textIdx);

    expect(prompt).toContain("- never break the noir voice with modern slang");
    expect(prompt).toContain("- keep sentences short");
    expect(prompt).toContain("Input: The meeting got rescheduled to tomorrow.");
    expect(prompt).toContain(
      "Output: The meeting slipped a day, like everything else in this rotten town.",
    );
    expect(prompt).not.toContain("Context:");
  });

  it("produces a coherent prompt for a minimal profile with no empty sections", () => {
    const prompt = buildPrompt({
      profile: bareMinimum,
      mode: "generate",
      text: "Write a short greeting.",
    });

    expect(prompt).toContain('You are writing in the voice of "Bare Minimum".');
    expect(prompt).toContain("Just the required fields.");
    expect(prompt).toContain(
      "Write new text in this voice, following the instruction below.",
    );
    expect(prompt).toContain("Instruction:\nWrite a short greeting.");

    expect(prompt).not.toContain("Style:");
    expect(prompt).not.toContain("Rules you must follow:");
    expect(prompt).not.toContain("Examples of this voice in action:");
    expect(prompt).not.toContain("Respond in");
    expect(prompt).not.toContain("Context:");
    expect(prompt).not.toContain("undefined");
  });

  it("frames rewrite mode as text-to-transform", () => {
    const prompt = buildPrompt({
      profile: bareMinimum,
      mode: "rewrite",
      text: "hello world",
    });

    expect(prompt).toContain(
      "Rewrite the following text in this voice. Preserve its meaning and intent, but fully commit to the voice above.",
    );
    expect(prompt).toContain("Text to rewrite:\nhello world");
    expect(prompt).not.toContain("Instruction:");
  });

  it("frames generate mode as an instruction", () => {
    const prompt = buildPrompt({
      profile: bareMinimum,
      mode: "generate",
      text: "hello world",
    });

    expect(prompt).toContain("Write new text in this voice, following the instruction below.");
    expect(prompt).toContain("Instruction:\nhello world");
    expect(prompt).not.toContain("Text to rewrite:");
  });

  it("includes a Context section only when context is supplied", () => {
    const withoutContext = buildPrompt({
      profile: bareMinimum,
      mode: "rewrite",
      text: "hello",
    });
    const withContext = buildPrompt({
      profile: bareMinimum,
      mode: "rewrite",
      context: "twitter reply, keep under 280 chars",
      text: "hello",
    });

    expect(withoutContext).not.toContain("Context:");
    expect(withContext).toContain("Context: twitter reply, keep under 280 chars");
  });

  it("includes a target length instruction only when options.targetLength is supplied", () => {
    const without = buildPrompt({ profile: bareMinimum, mode: "generate", text: "hi" });
    const withLength = buildPrompt({
      profile: bareMinimum,
      mode: "generate",
      text: "hi",
      options: { targetLength: 120 },
    });

    expect(without).not.toContain("Target length");
    expect(withLength).toContain("Target length: approximately 120 words.");
  });

  it("includes a diacritics instruction only when options.diacritics is 'strip'", () => {
    const withDefault = buildPrompt({
      profile: bareMinimum,
      mode: "generate",
      text: "hi",
      options: { diacritics: "default" },
    });
    const withStrip = buildPrompt({
      profile: bareMinimum,
      mode: "generate",
      text: "hi",
      options: { diacritics: "strip" },
    });

    expect(withDefault).not.toContain("diacritical marks");
    expect(withStrip).toContain("Do not use diacritical marks");
  });

  it("includes a multi-variant JSON instruction only when options.variantCount is greater than 1", () => {
    const singleVariant = buildPrompt({ profile: bareMinimum, mode: "generate", text: "hi" });
    const multiVariant = buildPrompt({
      profile: bareMinimum,
      mode: "generate",
      text: "hi",
      options: { variantCount: 3 },
    });

    expect(singleVariant).not.toContain("variants");
    expect(multiVariant).toContain('{"variants":');
    expect(multiVariant).toContain("exactly 3");
  });

  it("uses options.language instead of any profile-level language", () => {
    const prompt = buildPrompt({
      profile: bareMinimum,
      mode: "generate",
      text: "hi",
      options: { language: "ro" },
    });

    expect(prompt).toContain("Respond in ro.");
  });
});
