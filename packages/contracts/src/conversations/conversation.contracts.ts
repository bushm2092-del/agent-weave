import { z } from "zod"
import { conversationSchema } from "./conversation.types.js"

export const createConversationRequestSchema = z.object({
  agent: z.enum(["claude", "codex", "pi", "opencode"]),
  workspace: z.string().trim().min(1).max(4_096),
})

export const createConversationResponseSchema = conversationSchema

export const setConfigOptionRequestSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("select"), value: z.string() }),
  z.object({ type: z.literal("boolean"), value: z.boolean() }),
])

export type CreateConversationRequest = z.infer<typeof createConversationRequestSchema>
export type CreateConversationResponse = z.infer<typeof createConversationResponseSchema>
export type SetConfigOptionRequest = z.infer<typeof setConfigOptionRequestSchema>
