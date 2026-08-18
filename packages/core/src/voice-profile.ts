import { z } from "zod";

export const voiceProfileSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string()).optional(),
    examples: z
      .array(
        z
          .object({
            input: z.string().min(1),
            output: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
    constraints: z.array(z.string()).optional(),
    language: z.string().optional(),
  })
  .strict();

export type VoiceProfile = z.infer<typeof voiceProfileSchema>;
