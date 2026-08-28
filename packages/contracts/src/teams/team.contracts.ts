import { z } from "zod"
import { agentProviderSchema } from "../conversations/conversation.types.js"
import { messageAttachmentSchema } from "../conversations/run.contracts.js"
import { teamSchema, teamTaskStatusSchema } from "./team.types.js"

export const teamMemberInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  agent: agentProviderSchema,
  model: z.string().trim().min(1).max(200).optional(),
  rolePresetId: z.string().uuid().optional(),
})

export const createTeamRequestSchema = z.object({
  canvasId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(120),
  workspace: z.string().trim().min(1).max(4_096),
  leader: teamMemberInputSchema,
  members: z.array(teamMemberInputSchema).max(7).default([]),
})

export const updateTeamRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
})

export const addTeamMemberRequestSchema = teamMemberInputSchema

export const sendTeamMessageRequestSchema = z.object({
  message: z.string().trim().min(1).max(100_000),
  attachments: z.array(messageAttachmentSchema).max(20).default([]),
  clientMessageId: z.string().uuid().optional(),
})

export const teamMessageReceiptSchema = z.object({
  teamRunId: z.string().uuid(),
  messageId: z.string().uuid(),
  targetSlotId: z.string().uuid(),
  status: z.literal("queued"),
})

export const updateTeamTaskRequestSchema = z.object({
  subject: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(10_000).optional(),
  status: teamTaskStatusSchema.optional(),
  ownerSlotId: z.string().uuid().nullable().optional(),
  blockedBy: z.array(z.string().uuid()).max(50).optional(),
})

export const createTeamResponseSchema = teamSchema

export type AddTeamMemberRequest = z.infer<typeof addTeamMemberRequestSchema>
export type CreateTeamRequest = z.infer<typeof createTeamRequestSchema>
export type SendTeamMessageRequest = z.infer<typeof sendTeamMessageRequestSchema>
export type TeamMemberInput = z.infer<typeof teamMemberInputSchema>
export type TeamMessageReceipt = z.infer<typeof teamMessageReceiptSchema>
export type UpdateTeamRequest = z.infer<typeof updateTeamRequestSchema>
export type UpdateTeamTaskRequest = z.infer<typeof updateTeamTaskRequestSchema>
