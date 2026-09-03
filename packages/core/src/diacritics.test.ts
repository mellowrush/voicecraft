import { describe, expect, it } from "vitest";
import { canSafelyStripDiacritics, stripDiacritics } from "./diacritics.js";

describe("canSafelyStripDiacritics", () => {
  it("returns true for Romanian, French, and Portuguese (by code or name, case-insensitive)", () => {
    expect(canSafelyStripDiacritics("ro")).toBe(true);
    expect(canSafelyStripDiacritics("Romanian")).toBe(true);
    expect(canSafelyStripDiacritics("FR")).toBe(true);
    expect(canSafelyStripDiacritics("french")).toBe(true);
    expect(canSafelyStripDiacritics("pt")).toBe(true);
    expect(canSafelyStripDiacritics("Portuguese")).toBe(true);
  });

  it("returns false for languages where stripping would be linguistically wrong", () => {
    expect(canSafelyStripDiacritics("tr")).toBe(false);
    expect(canSafelyStripDiacritics("Turkish")).toBe(false);
    expect(canSafelyStripDiacritics("es")).toBe(false);
    expect(canSafelyStripDiacritics("Spanish")).toBe(false);
    expect(canSafelyStripDiacritics("pl")).toBe(false);
    expect(canSafelyStripDiacritics("de")).toBe(false);
  });

  it("returns false when language is unset", () => {
    expect(canSafelyStripDiacritics(undefined)).toBe(false);
  });
});

describe("stripDiacritics", () => {
  it("strips Romanian diacritics", () => {
    expect(stripDiacritics("Bună ziua, ce mai faci?")).toBe("Buna ziua, ce mai faci?");
  });

  it("strips French diacritics", () => {
    expect(stripDiacritics("Voilà, c'est très élégant.")).toBe("Voila, c'est tres elegant.");
  });

  it("strips Portuguese diacritics", () => {
    expect(stripDiacritics("Não é possível, mas é bom.")).toBe("Nao e possivel, mas e bom.");
  });

  it("leaves plain ASCII text unchanged", () => {
    expect(stripDiacritics("Hello, world!")).toBe("Hello, world!");
  });
});
