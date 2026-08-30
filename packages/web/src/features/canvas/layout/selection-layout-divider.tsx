import { useRef, type PointerEvent } from "react"
import type { Editor } from "tldraw"
import { useTranslation } from "react-i18next"

import type { AgentShape } from "@/features/canvas/shapes/agent/agent-shape"

import type { AgentSplit } from "./layout.types"

const MIN_AGENT_WIDTH = 280
const MIN_AGENT_HEIGHT = 240

type ScreenAgentSplit = AgentSplit & { screenX: number; screenY: number; screenLength: number }

type ResizeSession = {
  markId: string
  pointerId: number
  startClientPosition: number
  zoom: number
  before: AgentShape
  after: AgentShape
  beforeBounds: NonNullable<ReturnType<Editor["getShapePageBounds"]>>
  afterBounds: NonNullable<ReturnType<Editor["getShapePageBounds"]>>
  afterPageOrigin: { x: number; y: number }
}

export function SelectionLayoutDivider({ editor, split }: { editor: Editor; split: ScreenAgentSplit }) {
  const { t } = useTranslation()
  const resizeSession = useRef<ResizeSession | null>(null)

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const before = editor.getShape(split.beforeId)
    const after = editor.getShape(split.afterId)
    if (before?.type !== "agent" || after?.type !== "agent") return

    const beforeBounds = editor.getShapePageBounds(before)
    const afterBounds = editor.getShapePageBounds(after)
    if (!beforeBounds || !afterBounds) return

    editor.markEventAsHandled(event)
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeSession.current = {
      markId: editor.markHistoryStoppingPoint("resize agent split"),
      pointerId: event.pointerId,
      startClientPosition: split.orientation === "vertical" ? event.clientX : event.clientY,
      zoom: editor.getZoomLevel(),
      before,
      after,
      beforeBounds,
      afterBounds,
      afterPageOrigin: editor.getShapePageTransform(after).applyToPoint({ x: 0, y: 0 }),
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const session = resizeSession.current
    if (!session || session.pointerId !== event.pointerId) return

    const clientPosition = split.orientation === "vertical" ? event.clientX : event.clientY
    const requestedDelta = (clientPosition - session.startClientPosition) / session.zoom
    const beforeSize = split.orientation === "vertical" ? session.before.props.w : session.before.props.h
    const afterSize = split.orientation === "vertical" ? session.after.props.w : session.after.props.h
    const minimumSize = split.orientation === "vertical" ? MIN_AGENT_WIDTH : MIN_AGENT_HEIGHT
    const delta = Math.min(Math.max(requestedDelta, minimumSize - beforeSize), afterSize - minimumSize)

    const afterPageOrigin = {
      x: session.afterPageOrigin.x + (split.orientation === "vertical" ? delta : 0),
      y: session.afterPageOrigin.y + (split.orientation === "horizontal" ? delta : 0),
    }
    const afterLocalOrigin = editor.getPointInParentSpace(session.after, afterPageOrigin)

    editor.updateShapes<AgentShape>([
      {
        id: session.before.id,
        type: "agent",
        props:
          split.orientation === "vertical"
            ? { w: session.before.props.w + delta }
            : { h: session.before.props.h + delta },
      },
      {
        id: session.after.id,
        type: "agent",
        x: afterLocalOrigin.x,
        y: afterLocalOrigin.y,
        props:
          split.orientation === "vertical"
            ? { w: session.after.props.w - delta }
            : { h: session.after.props.h - delta },
      },
    ])
  }

  const finishResize = (event: PointerEvent<HTMLDivElement>) => {
    const session = resizeSession.current
    if (!session || session.pointerId !== event.pointerId) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    editor.squashToMark(session.markId)
    resizeSession.current = null
  }

  const cancelResize = (event: PointerEvent<HTMLDivElement>) => {
    const session = resizeSession.current
    if (!session || session.pointerId !== event.pointerId) return
    editor.bailToMark(session.markId)
    resizeSession.current = null
  }

  return (
    <div
      aria-label={t("canvas.layout.resizeSplit")}
      className="selection-layout-divider"
      data-orientation={split.orientation}
      role="separator"
      style={{
        left: split.screenX,
        top: split.screenY,
        ...(split.orientation === "vertical" ? { height: split.screenLength } : { width: split.screenLength }),
      }}
      onPointerCancel={cancelResize}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishResize}
    />
  )
}
