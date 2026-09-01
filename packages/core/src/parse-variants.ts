// Parses N variants out of a single raw provider response, per the
// convention researched for wayfinder ticket #62: a JSON object rooted at
// `{"variants": [...]}` (the only root shape both OpenAI's and Anthropic's
// structured-output docs confirm), falling back to a fixed text delimiter,
// and finally to treating the whole response as one variant. Never throws —
// "return whatever parsed cleanly" is the map's decided policy.
const DELIMITER = "\n===VARIANT===\n";

export function parseVariants(raw: string, requestedCount: number): string[] {
  const trimmed = raw.trim();
  if (requestedCount <= 1) return [trimmed];

  return parseJsonVariants(trimmed) ?? parseDelimitedVariants(trimmed) ?? [trimmed];
}

// Some models wrap the JSON object in prose or a ```json code fence despite
// instructions — grab the first {...} block rather than requiring the whole
// response be valid JSON on its own.
function parseJsonVariants(text: string): string[] | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    if (typeof parsed !== "object" || parsed === null || !("variants" in parsed)) return null;
    const variants = (parsed as { variants: unknown }).variants;
    if (!Array.isArray(variants)) return null;

    const strings = variants.filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    );
    return strings.length > 0 ? strings : null;
  } catch {
    return null;
  }
}

function parseDelimitedVariants(text: string): string[] | null {
  const segments = text
    .split(DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return segments.length > 1 ? segments : null;
}
