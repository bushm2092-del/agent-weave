import { useCallback } from "react"
import { type Editor, useValue } from "tldraw"

import { applyAgentLayout, getSelectedAgentShapes, getSelectedAgentSplit } from "./selection-layout"
import type { AgentLayoutPreset } from "./layout.types"

const TOOLBAR_HALF_WIDTH = 124
const TOOLBAR_GAP = 10
const TOOLBAR_HEIGHT = 36

export function useSelectionLayout(editor: Editor) {
  const selection = useValue(
    "selected-agent-layout-toolbar",
    () => {
      const shapes = getSelectedAgentShapes(editor)
      const bounds = shapes.flatMap((shape) => {
        const bounds = editor.getShapePageBounds(shape)
        return bounds ? [bounds] : []
      })
      if (bounds.length < 2) return null

      const minX = Math.min(...bounds.map((bound) => bound.minX))
      const minY = Math.min(...bounds.map((bound) => bound.minY))
      const maxX = Math.max(...bounds.map((bound) => bound.maxX))
      const maxY = Math.max(...bounds.map((bound) => bound.maxY))
      const topCenter = editor.pageToViewport({ x: (minX + maxX) / 2, y: minY })
      const bottomCenter = editor.pageToViewport({ x: (minX + maxX) / 2, y: maxY })
      const viewport = editor.getViewportScreenBounds()
      const x = Math.min(Math.max(topCenter.x, TOOLBAR_HALF_WIDTH + 8), viewport.w - TOOLBAR_HALF_WIDTH - 8)
      const preferredY =
        topCenter.y >= TOOLBAR_HEIGHT + TOOLBAR_GAP
          ? topCenter.y - TOOLBAR_HEIGHT - TOOLBAR_GAP
          : bottomCenter.y + TOOLBAR_GAP
      const y = Math.min(Math.max(preferredY, 8), viewport.h - TOOLBAR_HEIGHT - 8)

      const pageSplit = getSelectedAgentSplit(editor)
      const split = pageSplit
        ? (() => {
            const start = editor.pageToViewport({ x: pageSplit.x, y: pageSplit.y })
            const end = editor.pageToViewport({
              x: pageSplit.x + (pageSplit.orientation === "horizontal" ? pageSplit.length : 0),
              y: pageSplit.y + (pageSplit.orientation === "vertical" ? pageSplit.length : 0),
            })
            return {
              ...pageSplit,
              screenX: start.x,
              screenY: start.y,
              screenLength: pageSplit.orientation === "vertical" ? end.y - start.y : end.x - start.x,
            }
          })()
        : null

      return { count: shapes.length, split, x, y }
    },
    [editor],
  )

  const applyLayout = useCallback(
    (preset: AgentLayoutPreset) => {
      applyAgentLayout(editor, preset)
    },
    [editor],
  )

  return { selection, applyLayout }
}
