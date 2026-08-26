import { z } from "zod"
import { tokenUsageSchema } from "./conversation.types.js"

export const runStatusSchema = z.enum(["queued", "running", "completed", "failed", "cancelled"])

export const messageAttachmentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("workspace_file"),
    path: z.string().trim().min(1).max(4_096),
  }),
  z.object({
    type: z.literal("image"),
    mediaType: z.string().regex(/^image\/[a-zA-Z0-9.+-]+$/),
    data: z.string().min(1).max(28_000_000),
    name: z.string().max(255).optional(),
  }),
])

export const createRunRequestSchema = z.object({
  message: z.string().trim().min(1).max(100_000),
  attachments: z.array(messageAttachmentSchema).max(20).default([]),
})

export const runSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  status: runStatusSchema,
  message: z.string(),
  attachments: z.array(messageAttachmentSchema),
  assistantText: z.string(),
  thoughtText: z.string(),
  error: z.string().optional(),
  stopReason: z.string().optional(),
  usage: tokenUsageSchema.optional(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
})

export const permissionOptionSchema = z.object({
  optionId: z.string(),
  name: z.string(),
  kind: z.enum(["allow_once", "allow_always", "reject_once", "reject_always"]),
})

export const decidePermissionRequestSchema = z.object({
  optionId: z.string().min(1),
})

export type CreateRunRequest = z.infer<typeof createRunRequestSchema>
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>
export type Run = z.infer<typeof runSchema>
export type RunStatus = z.infer<typeof runStatusSchema>
export type PermissionOption = z.infer<typeof permissionOptionSchema>
export type DecidePermissionRequest = z.infer<typeof decidePermissionRequestSchema>
