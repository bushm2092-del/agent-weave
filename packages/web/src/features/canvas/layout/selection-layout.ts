import type { Editor } from "tldraw"

import type { AgentShape } from "@/features/canvas/shapes/agent/agent-shape"

import { calculateAgentLayout } from "./layout-presets"
import type { AgentLayoutPreset, LayoutItem } from "./layout.types"

export function getSelectedAgentShapes(editor: Editor) {
  return editor
    .getSelectedShapes()
    .filter((shape): shape is AgentShape => shape.type === "agent" && !editor.isShapeOrAncestorLocked(shape))
}

export function applyAgentLayout(editor: Editor, preset: AgentLayoutPreset) {
  const shapes = getSelectedAgentShapes(editor)
  if (shapes.length < 2) return false

  const items = shapes.flatMap<LayoutItem>((shape) => {
    const bounds = editor.getShapePageBounds(shape)
    return bounds ? [{ id: shape.id, x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h }] : []
  })
  if (items.length < 2) return false

  const placements = calculateAgentLayout(items, preset, { primaryId: shapes.at(-1)?.id })
  const placementsById = new Map(placements.map((placement) => [placement.id, placement]))

  editor.markHistoryStoppingPoint(`layout agents: ${preset}`)
  editor.updateShapes<AgentShape>(
    shapes.map((shape) => {
      const bounds = editor.getShapePageBounds(shape)!
      const placement = placementsById.get(shape.id)!
      const pageOrigin = editor.getShapePageTransform(shape).applyToPoint({ x: 0, y: 0 })
      const localOrigin = editor.getPointInParentSpace(shape, {
        x: pageOrigin.x + placement.x - bounds.x,
        y: pageOrigin.y + placement.y - bounds.y,
      })

      return { id: shape.id, type: "agent", x: localOrigin.x, y: localOrigin.y }
    }),
  )
  return true
}
