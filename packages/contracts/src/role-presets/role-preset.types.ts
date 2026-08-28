import { z } from "zod"
import { agentProviderSchema } from "../conversations/conversation.types.js"

export const rolePresetSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  agent: agentProviderSchema,
  systemPrompt: z.string(),
  builtIn: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type RolePreset = z.infer<typeof rolePresetSchema>
