import type { CanvasAccent } from "@agent-weave/contracts"

export type StoredCanvas = {
  id: string
  name: string
  description: string
  accent: CanvasAccent
  createdAt: string
  updatedAt: string
}

export interface CanvasRepository {
  create(canvas: StoredCanvas): StoredCanvas
  get(canvasId: string): StoredCanvas | undefined
  list(): StoredCanvas[]
  update(canvasId: string, patch: Partial<Pick<StoredCanvas, "name" | "description" | "accent" | "updatedAt">>): StoredCanvas | undefined
  delete(canvasId: string): boolean
  getSnapshot(canvasId: string): { document: unknown; thumbnailDataUrl: string | null; updatedAt: string } | undefined
  saveSnapshot(canvasId: string, document: unknown, thumbnailDataUrl: string | null, updatedAt: string): void
}
