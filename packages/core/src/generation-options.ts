import { z } from "zod";

// Shared shape between VoiceProfile.defaultGenerationOptions (ADR-0006) and
// Engine's generate() request.options (ADR-0007) — a profile's defaults and
// whatever a call actually sends are never two different types.
export const generationOptionsSchema = z
  .object({
    targetLength: z.number().int().positive().optional(),
    variantCount: z.number().int().min(1).max(6).optional(),
    language: z.string().optional(),
    diacritics: z.enum(["default", "strip"]).optional(),
  })
  .strict();

export type GenerationOptions = z.infer<typeof generationOptionsSchema>;
