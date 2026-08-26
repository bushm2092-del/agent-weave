import type { Run } from "@agent-weave/contracts"
import { AlertCircle, Brain, Clock3, Image, Paperclip } from "lucide-react"

import { PermissionRequest } from "@/features/conversations/components/permissions/permission-request"
import { ToolCallItem } from "@/features/conversations/components/messages/tool-call-item"
import type { PendingPermission, ToolActivity } from "@/features/conversations/conversation-view.types"

export function RunMessage({
  conversationId,
  run,
  tools,
  permissions,
}: {
  conversationId: string
  run: Run
  tools: ToolActivity[]
  permissions: PendingPermission[]
}) {
  return (
    <article className="conversation-run">
      <div className="conversation-message conversation-message--user">
        <p>{run.message}</p>
        {!!run.attachments.length && (
          <div className="conversation-message__attachments">
            {run.attachments.map((attachment, index) => (
              <span key={`${attachment.type}-${index}`}>
                {attachment.type === "image" ? <Image /> : <Paperclip />}
                {attachment.type === "image" ? attachment.name || "Image" : attachment.path}
              </span>
            ))}
          </div>
        )}
      </div>

      {!!run.thoughtText && (
        <details className="thought-section">
          <summary>
            <Brain aria-hidden="true" />
            Thought process
          </summary>
          <p>{run.thoughtText}</p>
        </details>
      )}

      {!!tools.length && (
        <div className="tool-call-list">
          {tools.map((tool) => (
            <ToolCallItem key={tool.id} tool={tool} />
          ))}
        </div>
      )}

      {permissions.map((permission) => (
        <PermissionRequest conversationId={conversationId} key={permission.id} permission={permission} />
      ))}

      <div className="conversation-message conversation-message--assistant">
        {run.assistantText ? (
          <p>{run.assistantText}</p>
        ) : run.status === "failed" ? (
          <p className="conversation-message__error">
            <AlertCircle />
            {run.error || "The run failed."}
          </p>
        ) : run.status === "cancelled" ? (
          <p className="conversation-message__muted">Run stopped</p>
        ) : (
          <p className="conversation-message__working">
            <CircleLoader />
            {run.status === "queued" ? "Queued" : "Working"}
          </p>
        )}
        {run.usage && <UsageSummary run={run} />}
      </div>
    </article>
  )
}

function UsageSummary({ run }: { run: Run }) {
  const usage = run.usage
  if (!usage) return null
  const total = usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
  return (
    <span className="usage-summary" title={`Input ${usage.inputTokens ?? 0}, output ${usage.outputTokens ?? 0}`}>
      <Clock3 />
      {total.toLocaleString()} tokens
    </span>
  )
}

function CircleLoader() {
  return <span className="conversation-loader" aria-hidden="true" />
}
