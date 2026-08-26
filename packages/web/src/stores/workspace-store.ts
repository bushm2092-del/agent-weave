import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

type WorkspaceState = {
  canvasName: string
  renameCanvas: (name: string) => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  immer((set) => ({
    canvasName: 'Untitled canvas',
    renameCanvas: (name) => {
      set((state) => {
        state.canvasName = name
      })
    },
  })),
)
