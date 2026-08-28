import { z } from "zod"
import { agentProviderSchema } from "../conversations/conversation.types.js"

export const teamSessionStatusSchema = z.enum(["starting", "ready", "failed", "stopped"])
export const teamMemberRoleSchema = z.enum(["leader", "teammate"])
export const teamMemberRuntimeStatusSchema = z.enum(["pending", "ready", "failed", "removing"])
export const teamMemberWorkStatusSchema = z.enum(["idle", "queued", "running", "blocked"])
export const teamRunStatusSchema = z.enum(["accepted", "running", "cancelling", "completed", "cancelled", "failed"])
export const teamTaskStatusSchema = z.enum(["pending", "in_progress", "completed", "blocked", "cancelled"])
export const teamSpawnRequestStatusSchema = z.enum(["pending", "approved", "rejected"])

export const teamMemberSchema = z.object({
  slotId: z.string().uuid(),
  teamId: z.string().uuid(),
  conversationId: z.string().uuid(),
  name: z.string(),
  role: teamMemberRoleSchema,
  agent: agentProviderSchema,
  model: z.string().optional(),
  rolePresetId: z.string().uuid().optional(),
  runtimeStatus: teamMemberRuntimeStatusSchema,
  workStatus: teamMemberWorkStatusSchema,
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const teamRunSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  targetSlotId: z.string().uuid(),
  status: teamRunStatusSchema,
  source: z.enum(["team_message", "member_message", "agent_message"]),
  hasUserIntervention: z.boolean(),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
})

export const teamTaskSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  subject: z.string(),
  description: z.string(),
  status: teamTaskStatusSchema,
  ownerSlotId: z.string().uuid().optional(),
  blockedBy: z.array(z.string().uuid()),
  createdBySlotId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const teamSpawnRequestSchema = z.object({
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  requestedBySlotId: z.string().uuid(),
  name: z.string(),
  agent: agentProviderSchema,
  model: z.string().optional(),
  status: teamSpawnRequestStatusSchema,
  memberSlotId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional(),
})

export const teamSchema = z.object({
  id: z.string().uuid(),
  canvasId: z.string(),
  name: z.string(),
  workspace: z.string(),
  leaderSlotId: z.string().uuid(),
  sessionStatus: teamSessionStatusSchema,
  error: z.string().optional(),
  members: z.array(teamMemberSchema),
  tasks: z.array(teamTaskSchema),
  spawnRequests: z.array(teamSpawnRequestSchema),
  activeRun: teamRunSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const createdTeamSchema = teamSchema.extend({
  controlToken: z.string().min(32),
})

export type Team = z.infer<typeof teamSchema>
export type CreatedTeam = z.infer<typeof createdTeamSchema>
export type TeamMember = z.infer<typeof teamMemberSchema>
export type TeamMemberRole = z.infer<typeof teamMemberRoleSchema>
export type TeamMemberRuntimeStatus = z.infer<typeof teamMemberRuntimeStatusSchema>
export type TeamMemberWorkStatus = z.infer<typeof teamMemberWorkStatusSchema>
export type TeamRun = z.infer<typeof teamRunSchema>
export type TeamRunStatus = z.infer<typeof teamRunStatusSchema>
export type TeamSessionStatus = z.infer<typeof teamSessionStatusSchema>
export type TeamTask = z.infer<typeof teamTaskSchema>
export type TeamTaskStatus = z.infer<typeof teamTaskStatusSchema>
export type TeamSpawnRequest = z.infer<typeof teamSpawnRequestSchema>
export type TeamSpawnRequestStatus = z.infer<typeof teamSpawnRequestStatusSchema>
