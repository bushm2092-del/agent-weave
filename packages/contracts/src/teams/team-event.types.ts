import { z } from "zod"

export const teamEventTypeSchema = z.enum([
  "team.created",
  "team.updated",
  "team.deleted",
  "team.session.updated",
  "team.member.added",
  "team.member.updated",
  "team.member.removed",
  "team.task.created",
  "team.task.updated",
  "team.spawn.requested",
  "team.spawn.resolved",
  "team.run.accepted",
  "team.run.started",
  "team.run.updated",
  "team.run.completed",
  "team.run.cancelled",
  "team.run.failed",
  "team.child-turn.queued",
  "team.child-turn.started",
  "team.child-turn.completed",
  "team.child-turn.cancelled",
  "team.child-turn.failed",
  "team.message.sent",
])

export const teamEventSchema = z.object({
  sequence: z.number().int().nonnegative(),
  id: z.string().uuid(),
  teamId: z.string().uuid(),
  teamRunId: z.string().uuid().optional(),
  slotId: z.string().uuid().optional(),
  type: teamEventTypeSchema,
  data: z.unknown(),
  createdAt: z.string().datetime(),
})

export type TeamEvent = z.infer<typeof teamEventSchema>
export type TeamEventType = z.infer<typeof teamEventTypeSchema>
