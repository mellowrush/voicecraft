import type { Mode } from "./mode.js";
import type { VoiceProfile } from "./voice-profile.js";

export function buildPrompt(request: {
  profile: VoiceProfile;
  mode: Mode;
  context?: string;
  text: string;
}): string {
  const { profile, mode, context, text } = request;

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

  if (profile.language) {
    sections.push(`Respond in ${profile.language}.`);
  }

  if (context) {
    sections.push(`Context: ${context}`);
  }

  sections.push(
    mode === "rewrite"
      ? `Rewrite the following text in this voice. Preserve its meaning and intent, but fully commit to the voice above.\n\nText to rewrite:\n${text}`
      : `Write new text in this voice, following the instruction below.\n\nInstruction:\n${text}`,
  );

  return sections.join("\n\n");
}
