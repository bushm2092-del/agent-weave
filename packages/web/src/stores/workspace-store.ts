import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

type WorkspaceState = {
  canvasNames: Record<string, string>
  renameCanvas: (canvasId: string, name: string) => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  immer((set) => ({
    canvasNames: {},
    renameCanvas: (canvasId, name) => {
      set((state) => {
        state.canvasNames[canvasId] = name
      })
    },
  })),
)
