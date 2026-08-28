import type { CanvasSummary, CreateCanvasRequest, UpdateCanvasRequest } from "@agent-weave/contracts"
import { canvasApi } from "../api"
import { useCanvasStore } from "../store"

class CanvasController {
  async load(): Promise<CanvasSummary[]> {
    const state = useCanvasStore.getState()
    state.setLoading(true)
    state.setError(undefined)
    try {
      const canvases = await canvasApi.list()
      useCanvasStore.getState().setCanvases(canvases)
      return canvases
    } catch (error) {
      useCanvasStore.getState().setError(messageOf(error))
      throw error
    } finally {
      useCanvasStore.getState().setLoading(false)
    }
  }

  async get(canvasId: string): Promise<CanvasSummary> {
    const canvas = await canvasApi.get(canvasId)
    useCanvasStore.getState().upsertCanvas(canvas)
    return canvas
  }

  async create(input: CreateCanvasRequest): Promise<CanvasSummary> {
    const canvas = await canvasApi.create(input)
    useCanvasStore.getState().upsertCanvas(canvas)
    return canvas
  }

  async update(canvasId: string, input: UpdateCanvasRequest): Promise<CanvasSummary> {
    const canvas = await canvasApi.update(canvasId, input)
    useCanvasStore.getState().upsertCanvas(canvas)
    return canvas
  }

  async delete(canvasId: string): Promise<void> {
    await canvasApi.delete(canvasId)
    useCanvasStore.getState().removeCanvas(canvasId)
  }

  async duplicate(source: CanvasSummary): Promise<CanvasSummary> {
    const created = await this.create({
      name: `${source.name} copy`,
      description: source.description,
      accent: source.accent,
    })
    try {
      const snapshot = await canvasApi.getSnapshot(source.id)
      if (snapshot.document) {
        await canvasApi.saveSnapshot(created.id, {
          document: snapshot.document,
          thumbnailDataUrl: snapshot.thumbnailDataUrl,
        })
      }
      return await this.get(created.id)
    } catch (error) {
      await this.delete(created.id).catch(() => undefined)
      throw error
    }
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load canvases."
}

export const canvasController = new CanvasController()
