import { z } from "zod"
import { agentProviderSchema } from "../conversations/conversation.types.js"

const rolePresetFieldsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  category: z.string().trim().min(1).max(40),
  agent: agentProviderSchema,
  systemPrompt: z.string().trim().min(1).max(20_000),
})

export const createRolePresetRequestSchema = rolePresetFieldsSchema
export const updateRolePresetRequestSchema = rolePresetFieldsSchema.partial().refine((value) => Object.keys(value).length > 0)

export type CreateRolePresetRequest = z.infer<typeof createRolePresetRequestSchema>
export type UpdateRolePresetRequest = z.infer<typeof updateRolePresetRequestSchema>
