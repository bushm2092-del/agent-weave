import { z } from "zod"
import { agentProviderSchema, tokenUsageSchema } from "./conversation.types.js"

export const createConversationRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  agent: agentProviderSchema,
  model: z.string().trim().min(1).max(200).optional(),
  workspace: z.string().trim().min(1).max(4_096),
  message: z.string().trim().min(1).max(100_000),
})

export const createConversationResponseSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
  agent: agentProviderSchema,
  model: z.string().optional(),
  content: z.string(),
  stopReason: z.string().optional(),
  usage: tokenUsageSchema.optional(),
})

export type CreateConversationRequest = z.infer<typeof createConversationRequestSchema>
export type CreateConversationResponse = z.infer<typeof createConversationResponseSchema>
