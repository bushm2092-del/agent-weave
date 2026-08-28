import { z } from "zod"
import { canvasAccentSchema } from "./canvas.types.js"

export const createCanvasRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).default("Untitled canvas"),
  description: z.string().trim().max(500).default(""),
  accent: canvasAccentSchema.default("blue"),
})

export const updateCanvasRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    accent: canvasAccentSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.")

export const saveCanvasSnapshotRequestSchema = z.object({
  document: z.unknown(),
  thumbnailDataUrl: z.string().startsWith("data:image/webp;base64,").max(1_000_000).nullable().optional(),
})

export type CreateCanvasRequest = z.infer<typeof createCanvasRequestSchema>
export type SaveCanvasSnapshotRequest = z.infer<typeof saveCanvasSnapshotRequestSchema>
export type UpdateCanvasRequest = z.infer<typeof updateCanvasRequestSchema>
