import { z } from "zod"

export const conversationEventTypeSchema = z.enum([
  "conversation.initializing",
  "conversation.ready",
  "conversation.failed",
  "conversation.deleted",
  "config.updated",
  "run.queued",
  "run.started",
  "assistant.delta",
  "thought.delta",
  "tool.updated",
  "usage.updated",
  "permission.requested",
  "permission.resolved",
  "run.completed",
  "run.failed",
  "run.cancelled",
])

export const conversationEventSchema = z.object({
  sequence: z.number().int().nonnegative(),
  transient: z.boolean().optional(),
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  runId: z.string().uuid().optional(),
  type: conversationEventTypeSchema,
  data: z.unknown(),
  createdAt: z.string().datetime(),
})

export type ConversationEventType = z.infer<typeof conversationEventTypeSchema>
export type ConversationEvent = z.infer<typeof conversationEventSchema>
