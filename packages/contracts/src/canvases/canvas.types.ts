import { z } from "zod"

export const canvasAccentSchema = z.enum(["coral", "green", "blue", "orange"])

export const canvasSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  accent: canvasAccentSchema,
  agents: z.number().int().nonnegative(),
  teams: z.number().int().nonnegative(),
  thumbnailDataUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const canvasSnapshotSchema = z.object({
  canvasId: z.string(),
  document: z.unknown().nullable(),
  thumbnailDataUrl: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

export type CanvasAccent = z.infer<typeof canvasAccentSchema>
export type CanvasSnapshot = z.infer<typeof canvasSnapshotSchema>
export type CanvasSummary = z.infer<typeof canvasSummarySchema>
