// Diacritics stripping, per the research for wayfinder ticket #63: naive
// Unicode NFD decomposition + combining-mark removal is only linguistically
// safe for languages with an accepted informal "no diacritics" writing
// convention. Turkish (ç/ş/ğ), Spanish (ñ), and Polish/German (which need
// digraph substitution, not stripping) are deliberately excluded — this list
// only grows once a language's convention has been verified the same way.
const SAFE_LANGUAGES = new Set(["ro", "romanian", "fr", "french", "pt", "portuguese"]);

// Combining Diacritical Marks block, U+0300-U+036F (UAX #15).
const COMBINING_MARKS = /[̀-ͯ]/g;

export function canSafelyStripDiacritics(language: string | undefined): boolean {
  if (!language) return false;
  return SAFE_LANGUAGES.has(language.trim().toLowerCase());
}

export function stripDiacritics(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "");
}
