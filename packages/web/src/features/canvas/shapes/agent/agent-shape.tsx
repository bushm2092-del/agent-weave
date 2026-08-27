/* oxlint-disable react/only-export-components -- tldraw shape utilities own their renderers. */
import { Link2 } from "lucide-react"
import { useEffect, useState, type PointerEvent } from "react"
import { createPortal } from "react-dom"
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
import { AgentRunnerIcon } from "@/features/canvas/agent-runner-icon"
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
    teamId: string
    slotId: string
    role: "" | "leader" | "teammate"
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
  AddTeamBinding: 3,
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
    teamId: T.string,
    slotId: T.string,
    role: T.literalEnum("", "leader", "teammate"),
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
      {
        id: Versions.AddTeamBinding,
        up: (props) => {
          props.teamId = ""
          props.slotId = ""
          props.role = ""
        },
        down: (props) => {
          delete props.teamId
          delete props.slotId
          delete props.role
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
      teamId: "",
      slotId: "",
      role: "",
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
  const [fullscreen, setFullscreen] = useState(false)
  const markHandled = (event: PointerEvent<HTMLElement>) => {
    if (!editor.getSelectedShapeIds().includes(shape.id)) editor.select(shape.id)
    editor.markEventAsHandled(event)
  }

  useEffect(() => {
    if (!fullscreen) return
    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false)
    }
    document.addEventListener("keydown", exitOnEscape)
    return () => document.removeEventListener("keydown", exitOnEscape)
  }, [fullscreen])

  const conversationWindow = shape.props.conversationId ? (
    <ConversationWindow
      conversationId={shape.props.conversationId}
      fullscreen={fullscreen}
      iconSrc={runner.iconSrc}
      onInteract={markHandled}
      onToggleFullscreen={() => setFullscreen((value) => !value)}
      provider={runner.provider}
      providerLabel={runner.label}
      title={shape.props.title}
      workspace={shape.props.workspace}
      {...(shape.props.teamId && shape.props.slotId
        ? { teamTarget: { teamId: shape.props.teamId, slotId: shape.props.slotId } }
        : {})}
    />
  ) : null

  return (
    <>
      <HTMLContainer className="agent-shape" style={{ width: shape.props.w, height: shape.props.h }}>
        {conversationWindow && !fullscreen ? conversationWindow : fullscreen ? (
          <div className="agent-shape__fullscreen-placeholder">Agent is open fullscreen</div>
        ) : (
        <LegacyAgent editor={editor} markHandled={markHandled} shape={shape} />
        )}
      </HTMLContainer>
      {fullscreen && conversationWindow &&
        createPortal(
          <div className="agent-fullscreen" role="dialog" aria-label={`${shape.props.title} fullscreen`}>
            <div className="agent-shape agent-shape--fullscreen">{conversationWindow}</div>
          </div>,
          document.body,
        )}
    </>
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
        <AgentRunnerIcon className="agent-shape__avatar" label={runner.label} src={runner.iconSrc} />
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
