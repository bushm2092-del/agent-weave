import type { Editor } from "tldraw"

import type { AgentShape } from "@/features/canvas/shapes/agent/agent-shape"

import { calculateAgentLayout } from "./layout-presets"
import type { AgentLayoutPreset, AgentSplit, LayoutItem } from "./layout.types"

const EDGE_TOLERANCE = 1

export function getSelectedAgentShapes(editor: Editor) {
  return editor
    .getSelectedShapes()
    .filter((shape): shape is AgentShape => shape.type === "agent" && !editor.isShapeOrAncestorLocked(shape))
}

export function getSelectedAgentSplit(editor: Editor): AgentSplit | null {
  const shapes = getSelectedAgentShapes(editor)
  if (shapes.length !== 2) return null
  if (shapes.some((shape) => Math.abs(editor.getShapePageTransform(shape).rotation()) > 0.001)) return null

  const firstBounds = editor.getShapePageBounds(shapes[0])
  const secondBounds = editor.getShapePageBounds(shapes[1])
  if (!firstBounds || !secondBounds) return null

  const [leftShape, rightShape, leftBounds, rightBounds] =
    firstBounds.x <= secondBounds.x
      ? [shapes[0], shapes[1], firstBounds, secondBounds]
      : [shapes[1], shapes[0], secondBounds, firstBounds]
  const verticalStart = Math.max(leftBounds.minY, rightBounds.minY)
  const verticalEnd = Math.min(leftBounds.maxY, rightBounds.maxY)
  if (Math.abs(leftBounds.maxX - rightBounds.minX) <= EDGE_TOLERANCE && verticalEnd > verticalStart) {
    return {
      orientation: "vertical",
      beforeId: leftShape.id,
      afterId: rightShape.id,
      x: leftBounds.maxX,
      y: verticalStart,
      length: verticalEnd - verticalStart,
    }
  }

  const [topShape, bottomShape, topBounds, bottomBounds] =
    firstBounds.y <= secondBounds.y
      ? [shapes[0], shapes[1], firstBounds, secondBounds]
      : [shapes[1], shapes[0], secondBounds, firstBounds]
  const horizontalStart = Math.max(topBounds.minX, bottomBounds.minX)
  const horizontalEnd = Math.min(topBounds.maxX, bottomBounds.maxX)
  if (Math.abs(topBounds.maxY - bottomBounds.minY) <= EDGE_TOLERANCE && horizontalEnd > horizontalStart) {
    return {
      orientation: "horizontal",
      beforeId: topShape.id,
      afterId: bottomShape.id,
      x: horizontalStart,
      y: topBounds.maxY,
      length: horizontalEnd - horizontalStart,
    }
  }

  return null
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

      return {
        id: shape.id,
        type: "agent",
        x: localOrigin.x,
        y: localOrigin.y,
        props: { w: placement.w, h: placement.h },
      }
    }),
  )
  return true
}
