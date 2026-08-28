import type { MessageAttachment, RunStatus } from "@agent-weave/contracts"
import { AlertCircle, Brain, ChevronRight, Clock3, Image, Paperclip } from "lucide-react"

import { MarkdownMessage } from "@/components/markdown"
import { ToolCallItem } from "@/features/conversations/components/messages/tool-call-item"
import { PermissionRequest } from "@/features/conversations/components/permissions/permission-request"
import type { PendingPermission, ToolActivity } from "@/features/conversations/conversation-view.types"

type MessageUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export type MessageRenderData =
  | {
      id: string
      role: "user"
      content: string
      attachments?: MessageAttachment[]
    }
  | {
      id: string
      role: "assistant"
      parts: MessageRenderPart[]
      status?: RunStatus
      error?: string
      usage?: MessageUsage
    }

export type MessageRenderPart =
  | { id: string; type: "markdown"; content: string }
  | { id: string; type: "thought"; content: string }
  | { id: string; type: "tool"; tool: ToolActivity }
  | { id: string; type: "permission"; permission: PendingPermission }

export function MessageRender({ message, conversationId }: { message: MessageRenderData; conversationId?: string }) {
  if (message.role === "user") {
    return (
      <div className="conversation-message conversation-message--user" data-message-id={message.id}>
        <p>{message.content}</p>
        {!!message.attachments?.length && <MessageAttachments attachments={message.attachments} />}
      </div>
    )
  }

  const status = message.status ?? "completed"
  const hasContent = message.parts.length > 0
  const renderParts = groupActivityParts(message.parts)

  return (
    <div className="conversation-message conversation-message--assistant" data-message-id={message.id}>
      {renderParts.map((part) => {
        if (part.type === "tools-group") return <ToolsGroup key={part.id} parts={part.parts} />
        if (part.type === "markdown") {
          return (
            <MarkdownMessage key={part.id} streaming={status === "queued" || status === "running"}>
              {part.content}
            </MarkdownMessage>
          )
        }
        if (part.type === "thought") return <ThoughtPart key={part.id} part={part} />
        if (part.type === "tool") return <ToolCallItem key={part.id} tool={part.tool} />
        return conversationId ? (
          <PermissionRequest conversationId={conversationId} key={part.id} permission={part.permission} />
        ) : null
      })}
      {status === "failed" ? (
        <p className="conversation-message__error">
          <AlertCircle />
          {message.error || "The run failed."}
        </p>
      ) : status === "cancelled" ? (
        <p className="conversation-message__muted">Run stopped</p>
      ) : !hasContent && (status === "queued" || status === "running") ? (
        <p className="conversation-message__working">
          <span className="conversation-loader" aria-hidden="true" />
          {status === "queued" ? "Queued" : "Working"}
        </p>
      ) : null}
      {message.usage && <UsageSummary usage={message.usage} />}
    </div>
  )
}

type ActivityPart = Extract<MessageRenderPart, { type: "thought" | "tool" }>
type GroupedRenderPart = MessageRenderPart | { id: string; type: "tools-group"; parts: ActivityPart[] }

function groupActivityParts(parts: MessageRenderPart[]): GroupedRenderPart[] {
  const grouped: GroupedRenderPart[] = []
  let activities: ActivityPart[] = []

  const flush = () => {
    if (activities.length === 1) grouped.push(activities[0])
    else if (activities.length > 1) {
      grouped.push({ id: `tools-group-${activities[0].id}`, type: "tools-group", parts: activities })
    }
    activities = []
  }

  for (const part of parts) {
    if (part.type === "thought" || part.type === "tool") activities.push(part)
    else {
      flush()
      grouped.push(part)
    }
  }
  flush()
  return grouped
}

function ToolsGroup({ parts }: { parts: ActivityPart[] }) {
  const running = parts.some((part) => part.type === "tool" && !isToolComplete(part.tool.status))
  return (
    <details className="tools-group">
      <summary>
        <ChevronRight aria-hidden="true" />
        <span>{running ? "处理中" : "已处理"}</span>
        <small>{parts.length} 项</small>
      </summary>
      <div className="tools-group__items">
        {parts.map((part) =>
          part.type === "thought" ? (
            <ThoughtPart key={part.id} part={part} />
          ) : (
            <ToolCallItem key={part.id} tool={part.tool} />
          ),
        )}
      </div>
    </details>
  )
}

function ThoughtPart({ part }: { part: Extract<MessageRenderPart, { type: "thought" }> }) {
  return (
    <details className="thought-section">
      <summary>
        <Brain aria-hidden="true" />
        Thought process
      </summary>
      <p>{part.content}</p>
    </details>
  )
}

function isToolComplete(status?: string): boolean {
  return status === "completed" || status === "done"
}

function MessageAttachments({ attachments }: { attachments: MessageAttachment[] }) {
  return (
    <div className="conversation-message__attachments">
      {attachments.map((attachment, index) => (
        <span key={`${attachment.type}-${index}`}>
          {attachment.type === "image" ? <Image /> : <Paperclip />}
          {attachment.type === "image" ? attachment.name || "Image" : attachment.path}
        </span>
      ))}
    </div>
  )
}

function UsageSummary({ usage }: { usage: MessageUsage }) {
  const total = usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
  return (
    <span className="usage-summary" title={`Input ${usage.inputTokens ?? 0}, output ${usage.outputTokens ?? 0}`}>
      <Clock3 />
      {total.toLocaleString()} tokens
    </span>
  )
}
