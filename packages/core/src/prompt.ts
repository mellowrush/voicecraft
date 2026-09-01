import type { Mode } from "./mode.js";
import type { VoiceProfile } from "./voice-profile.js";
import type { GenerationOptions } from "./generation-options.js";

export function buildPrompt(request: {
  profile: VoiceProfile;
  mode: Mode;
  context?: string;
  text: string;
  options?: GenerationOptions;
}): string {
  const { profile, mode, context, text, options } = request;

  const sections: string[] = [
    `You are writing in the voice of "${profile.name}".`,
    profile.description,
  ];

  if (profile.tags?.length) {
    sections.push(`Style: ${profile.tags.join(", ")}.`);
  }

  if (profile.constraints?.length) {
    sections.push(
      `Rules you must follow:\n${profile.constraints.map((c) => `- ${c}`).join("\n")}`,
    );
  }

  if (profile.examples?.length) {
    sections.push(
      `Examples of this voice in action:\n${profile.examples
        .map((e) => `Input: ${e.input}\nOutput: ${e.output}`)
        .join("\n\n")}`,
    );
  }

  if (options?.language) {
    sections.push(`Respond in ${options.language}.`);
  }

  if (options?.targetLength) {
    sections.push(`Target length: approximately ${options.targetLength} words.`);
  }

  if (options?.diacritics === "strip") {
    sections.push(
      "Do not use diacritical marks; write using unaccented Latin letters where the language allows.",
    );
  }

  if (context) {
    sections.push(`Context: ${context}`);
  }

  sections.push(
    mode === "rewrite"
      ? `Rewrite the following text in this voice. Preserve its meaning and intent, but fully commit to the voice above.\n\nText to rewrite:\n${text}`
      : `Write new text in this voice, following the instruction below.\n\nInstruction:\n${text}`,
  );

  const variantCount = options?.variantCount ?? 1;
  if (variantCount > 1) {
    sections.push(
      `Produce exactly ${variantCount} distinct variants of your response above. Return them as a single JSON object of the exact shape {"variants": ["...", "..."]} containing exactly ${variantCount} strings, and nothing else — no prose, no code fences, no explanation outside the JSON object.`,
    );
  }

  return sections.join("\n\n");
}
