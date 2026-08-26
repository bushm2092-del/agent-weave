/* oxlint-disable react/only-export-components -- tldraw shape utilities own their renderers. */
import { Send } from 'lucide-react'
import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  BaseBoxShapeUtil,
  type Editor,
  HTMLContainer,
  Rectangle2d,
  T,
  type TLBaseShape,
} from 'tldraw'

import { AGENT_RUNNERS, type AgentRunner } from '@/features/canvas/agent-options'

export type AgentShape = TLBaseShape<
  'agent',
  {
    w: number
    h: number
    runner: AgentRunner
    model: string
    workspace: string
    title: string
  }
>

declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    agent: AgentShape['props']
  }
}

export class AgentShapeUtil extends BaseBoxShapeUtil<AgentShape> {
  static override type = 'agent' as const
  static override props = {
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
    runner: T.literalEnum('claude-code', 'codex', 'pi', 'opencode'),
    model: T.string,
    workspace: T.string,
    title: T.string,
  }

  override getDefaultProps(): AgentShape['props'] {
    return {
      w: 320,
      h: 224,
      runner: 'codex',
      model: AGENT_RUNNERS.codex.models[0],
      workspace: '/workspace',
      title: 'Codex agent',
    }
  }

  override getGeometry(shape: AgentShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
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
    const [draft, setDraft] = useState('')
    const [lastMessage, setLastMessage] = useState<string | null>(null)
    const runner = AGENT_RUNNERS[shape.props.runner]

    const markHandled = (event: PointerEvent<HTMLElement>) => {
      editor.markEventAsHandled(event)
    }

    const sendMessage = () => {
      const message = draft.trim()
      if (!message) return
      setLastMessage(message)
      setDraft('')
    }

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
      editor.markEventAsHandled(event)
      if (event.key !== 'Enter') return
      event.preventDefault()
      sendMessage()
    }

    return (
      <HTMLContainer
        className="agent-shape"
        style={{ width: shape.props.w, height: shape.props.h }}
      >
        <div className="agent-shape__header">
          <div
            className="agent-shape__avatar"
            style={{ backgroundColor: runner.accent }}
          >
            {runner.shortLabel}
          </div>
          <div className="agent-shape__identity">
            <strong>{shape.props.title}</strong>
            <span>{runner.label}</span>
          </div>
          <span className="agent-shape__status">Ready</span>
        </div>

        <div className="agent-shape__conversation">
          <p>{lastMessage ?? 'Start a conversation in this workspace.'}</p>
          <div
            className="agent-shape__prompt"
            onPointerDown={markHandled}
            onPointerUp={markHandled}
          >
            <input
              aria-label={`Message ${shape.props.title}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask this agent anything..."
            />
            <button
              aria-label={`Send message to ${shape.props.title}`}
              disabled={!draft.trim()}
              type="button"
              onClick={sendMessage}
            >
              <Send />
            </button>
          </div>
        </div>

        <div className="agent-shape__meta">
          <span title={shape.props.model}>{shape.props.model}</span>
          <span title={shape.props.workspace}>{shape.props.workspace}</span>
        </div>
      </HTMLContainer>
    )
}
