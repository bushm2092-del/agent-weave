import { Bot } from "lucide-react"
import { useEffect, useRef } from "react"

import { RunMessage } from "@/features/conversations/components/messages/run-message"
import type { ConversationView } from "@/features/conversations/conversation-view.types"

export function MessageList({ conversationId, view }: { conversationId: string; view: ConversationView }) {
  const listRef = useRef<HTMLDivElement>(null)
  const lastRun = view.runs.at(-1)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [lastRun?.assistantText, lastRun?.thoughtText, view.runs.length, view.pendingPermissions])

  return (
    <div className="conversation-message-list" ref={listRef}>
      {!view.runs.length && (
        <div className="conversation-empty">
          <Bot aria-hidden="true" />
          <strong>Ready for a task</strong>
          <span>Send a message to start working in this workspace.</span>
        </div>
      )}
      {view.runs.map((run) => (
        <RunMessage
          conversationId={conversationId}
          key={run.id}
          permissions={Object.values(view.pendingPermissions).filter((item) => item.runId === run.id)}
          parts={view.partsByRun[run.id] ?? []}
          run={run}
          tools={view.toolsByRun[run.id] ?? []}
        />
      ))}
    </div>
  )
}
