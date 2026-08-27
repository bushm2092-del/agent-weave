import { z } from "zod"

export const filePathQuerySchema = z.object({
  path: z.string().trim().min(1).max(4_096),
})

export const fileEntryTypeSchema = z.enum(["directory", "file", "symlink"])
export const filePreviewTypeSchema = z.enum(["text", "image", "unsupported"])

export const fileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: fileEntryTypeSchema,
  size: z.number().int().nonnegative().optional(),
  mimeType: z.string().optional(),
  previewType: filePreviewTypeSchema,
  modifiedAt: z.string().datetime(),
})

export const directoryListingSchema = z.object({
  path: z.string(),
  entries: z.array(fileEntrySchema),
})

export const textFileSchema = z.object({
  path: z.string(),
  name: z.string(),
  content: z.string(),
  encoding: z.literal("utf-8"),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  modifiedAt: z.string().datetime(),
})

export type FilePathQuery = z.infer<typeof filePathQuerySchema>
export type FileEntry = z.infer<typeof fileEntrySchema>
export type FileEntryType = z.infer<typeof fileEntryTypeSchema>
export type FilePreviewType = z.infer<typeof filePreviewTypeSchema>
export type DirectoryListing = z.infer<typeof directoryListingSchema>
export type TextFile = z.infer<typeof textFileSchema>
