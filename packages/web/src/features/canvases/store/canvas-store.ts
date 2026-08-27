import type { CanvasSummary } from "@agent-weave/contracts"
import { create } from "zustand"
import { immer } from "zustand/middleware/immer"

type CanvasState = {
  canvases: CanvasSummary[]
  loading: boolean
  error?: string
  setLoading: (loading: boolean) => void
  setError: (error?: string) => void
  setCanvases: (canvases: CanvasSummary[]) => void
  upsertCanvas: (canvas: CanvasSummary) => void
  removeCanvas: (canvasId: string) => void
}

export const useCanvasStore = create<CanvasState>()(
  immer((set) => ({
    canvases: [],
    loading: false,
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    setCanvases: (canvases) => set({ canvases }),
    upsertCanvas: (canvas) => {
      set((state) => {
        const index = state.canvases.findIndex((item) => item.id === canvas.id)
        if (index === -1) state.canvases.unshift(canvas)
        else state.canvases[index] = canvas
      })
    },
    removeCanvas: (canvasId) => {
      set((state) => {
        state.canvases = state.canvases.filter((canvas) => canvas.id !== canvasId)
      })
    },
  })),
)
