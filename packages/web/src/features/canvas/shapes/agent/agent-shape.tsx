/* oxlint-disable react/only-export-components -- tldraw shape utilities own their renderers. */
import { Link2 } from "lucide-react"
import { useState, type PointerEvent } from "react"
import {
  BaseBoxShapeUtil,
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
  type Editor,
  HTMLContainer,
  Rectangle2d,
  T,
  type TLBaseShape,
} from "tldraw"

import { AGENT_RUNNERS, type AgentRunner } from "@/features/canvas/agent-options"
import { conversationApi, ConversationWindow } from "@/features/conversations"
import { ApiClientError } from "@/lib/api"

export type AgentShape = TLBaseShape<
  "agent",
  {
    w: number
    h: number
    runner: AgentRunner
    model: string
    workspace: string
    title: string
    conversationId: string
  }
>

declare module "tldraw" {
  interface TLGlobalShapePropsMap {
    agent: AgentShape["props"]
  }
}

const Versions = createShapePropsMigrationIds("agent", {
  AddConversationId: 1,
  ResizeConversationWindow: 2,
})

export class AgentShapeUtil extends BaseBoxShapeUtil<AgentShape> {
  static override type = "agent" as const
  static override props = {
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
    runner: T.literalEnum("claude-code", "codex", "pi", "opencode"),
    model: T.string,
    workspace: T.string,
    title: T.string,
    conversationId: T.string,
  }
  static override migrations = createShapePropsMigrationSequence({
    sequence: [
      {
        id: Versions.AddConversationId,
        up: (props) => {
          props.conversationId = ""
        },
        down: (props) => {
          delete props.conversationId
        },
      },
      {
        id: Versions.ResizeConversationWindow,
        up: (props) => {
          props.w = Math.max(Number(props.w) || 0, 420)
          props.h = Math.max(Number(props.h) || 0, 560)
        },
        down: (props) => {
          props.w = 320
          props.h = 224
        },
      },
    ],
  })

  override getDefaultProps(): AgentShape["props"] {
    return {
      w: 420,
      h: 560,
      runner: "codex",
      model: "",
      workspace: "",
      title: "Codex agent",
      conversationId: "",
    }
  }

  override getGeometry(shape: AgentShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true })
  }

  override component(shape: AgentShape) {
    return <AgentCard editor={this.editor} shape={shape} />
  }

  override getIndicatorPath(shape: AgentShape) {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 8)
    return path
  }
}

function AgentCard({ editor, shape }: { editor: Editor; shape: AgentShape }) {
  const runner = AGENT_RUNNERS[shape.props.runner]
  const markHandled = (event: PointerEvent<HTMLElement>) => {
    if (!editor.getSelectedShapeIds().includes(shape.id)) editor.select(shape.id)
    editor.markEventAsHandled(event)
  }

  return (
    <HTMLContainer className="agent-shape" style={{ width: shape.props.w, height: shape.props.h }}>
      {shape.props.conversationId ? (
        <ConversationWindow
          accent={runner.accent}
          conversationId={shape.props.conversationId}
          onInteract={markHandled}
          provider={runner.provider}
          providerLabel={runner.label}
          shortLabel={runner.shortLabel}
          title={shape.props.title}
          workspace={shape.props.workspace}
        />
      ) : (
        <LegacyAgent editor={editor} markHandled={markHandled} shape={shape} />
      )}
    </HTMLContainer>
  )
}

function LegacyAgent({
  editor,
  markHandled,
  shape,
}: {
  editor: Editor
  markHandled: (event: PointerEvent<HTMLElement>) => void
  shape: AgentShape
}) {
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string>()
  const runner = AGENT_RUNNERS[shape.props.runner]

  const connect = async () => {
    setConnecting(true)
    setError(undefined)
    try {
      const conversation = await conversationApi.create({
        agent: runner.provider,
        workspace: shape.props.workspace,
      })
      editor.updateShape<AgentShape>({
        id: shape.id,
        type: "agent",
        props: { conversationId: conversation.id },
      })
    } catch (requestError) {
      setError(requestError instanceof ApiClientError ? requestError.message : "Unable to connect this agent.")
      setConnecting(false)
    }
  }

  return (
    <>
      <div className="agent-shape__header">
        <div className="agent-shape__avatar" style={{ backgroundColor: runner.accent }}>
          {runner.shortLabel}
        </div>
        <div className="agent-shape__identity">
          <strong>{shape.props.title}</strong>
          <span>{runner.label}</span>
        </div>
        <span className="agent-shape__status" data-status="initializing">
          Offline
        </span>
      </div>
      <div className="legacy-agent" onPointerDown={markHandled} onPointerUp={markHandled}>
        <Link2 />
        <strong>Connect this agent</strong>
        <span>Existing canvas agents need a backend conversation before they can chat.</span>
        <button disabled={!shape.props.workspace || connecting} type="button" onClick={() => void connect()}>
          {connecting ? "Connecting..." : "Connect"}
        </button>
        {error && <p>{error}</p>}
      </div>
      <div className="agent-shape__meta">
        <span>{runner.provider}</span>
        <span title={shape.props.workspace}>{shape.props.workspace}</span>
      </div>
    </>
  )
}
