import type {
  CanvasSnapshot,
  CanvasSummary,
  CreateCanvasRequest,
  SaveCanvasSnapshotRequest,
  UpdateCanvasRequest,
} from "@agent-weave/contracts"
import { apiClient } from "@/lib/api"

const canvasesPath = "/canvases"

function canvasPath(canvasId: string): string {
  return `${canvasesPath}/${encodeURIComponent(canvasId)}`
}

export const canvasApi = {
  list(): Promise<CanvasSummary[]> {
    return apiClient.get(canvasesPath)
  },

  create(input: CreateCanvasRequest): Promise<CanvasSummary> {
    return apiClient.post<CanvasSummary, CreateCanvasRequest>(canvasesPath, input)
  },

  get(canvasId: string): Promise<CanvasSummary> {
    return apiClient.get(canvasPath(canvasId))
  },

  update(canvasId: string, input: UpdateCanvasRequest): Promise<CanvasSummary> {
    return apiClient.patch<CanvasSummary, UpdateCanvasRequest>(canvasPath(canvasId), input)
  },

  delete(canvasId: string): Promise<{ canvasId: string; deleted: boolean }> {
    return apiClient.delete(canvasPath(canvasId))
  },

  getSnapshot(canvasId: string): Promise<CanvasSnapshot> {
    return apiClient.get(`${canvasPath(canvasId)}/snapshot`)
  },

  saveSnapshot(canvasId: string, input: SaveCanvasSnapshotRequest): Promise<CanvasSnapshot> {
    return apiClient.put<CanvasSnapshot, SaveCanvasSnapshotRequest>(`${canvasPath(canvasId)}/snapshot`, input)
  },
}
