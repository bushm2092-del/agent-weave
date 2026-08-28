import type { Run } from "@agent-weave/contracts"

import { MessageRender, type MessageRenderPart } from "@/features/conversations/components/messages/message-render"
import type { PendingPermission, RunRenderPart, ToolActivity } from "@/features/conversations/conversation-view.types"

export function RunMessage({
  conversationId,
  run,
  tools,
  permissions,
  parts,
}: {
  conversationId: string
  run: Run
  tools: ToolActivity[]
  permissions: PendingPermission[]
  parts: RunRenderPart[]
}) {
  const assistantParts = buildAssistantParts(run, parts, tools, permissions)
  return (
    <article className="conversation-run">
      <MessageRender
        message={{ id: `${run.id}-user`, role: "user", content: run.message, attachments: run.attachments }}
      />

      <MessageRender
        conversationId={conversationId}
        message={{
          id: `${run.id}-assistant`,
          role: "assistant",
          parts: assistantParts,
          status: run.status,
          error: run.error,
          usage: run.usage,
        }}
      />
    </article>
  )
}

function buildAssistantParts(
  run: Run,
  timeline: RunRenderPart[],
  tools: ToolActivity[],
  permissions: PendingPermission[],
): MessageRenderPart[] {
  const toolById = new Map(tools.map((tool) => [tool.id, tool]))
  const permissionById = new Map(permissions.map((permission) => [permission.id, permission]))
  const parts: MessageRenderPart[] = []
  for (const part of timeline) {
    if (part.type === "tool") {
      const tool = toolById.get(part.toolId)
      if (tool) parts.push({ id: part.id, type: "tool", tool })
    } else if (part.type === "permission") {
      const permission = permissionById.get(part.permissionId)
      if (permission) parts.push({ id: part.id, type: "permission", permission })
    } else parts.push(part)
  }

  if (!timeline.length) {
    if (run.thoughtText) parts.push({ id: `${run.id}-thought`, type: "thought", content: run.thoughtText })
    parts.push(...tools.map((tool) => ({ id: `${run.id}-tool-${tool.id}`, type: "tool" as const, tool })))
    parts.push(
      ...permissions.map((permission) => ({
        id: `${run.id}-permission-${permission.id}`,
        type: "permission" as const,
        permission,
      })),
    )
  }

  appendMissingText(parts, "thought", run.thoughtText, `${run.id}-thought-rest`)
  appendMissingText(parts, "markdown", run.assistantText, `${run.id}-assistant-rest`)
  return parts
}

function appendMissingText(
  parts: MessageRenderPart[],
  type: "markdown" | "thought",
  completeText: string,
  id: string,
) {
  if (!completeText) return
  const rendered = parts
    .map((part) => (part.type === type ? part.content : ""))
    .join("")
  if (rendered === completeText) return
  const missing = completeText.startsWith(rendered) ? completeText.slice(rendered.length) : completeText
  if (missing) parts.push({ id, type, content: missing })
}
