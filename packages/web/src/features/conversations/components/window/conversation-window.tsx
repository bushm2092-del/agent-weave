import type { AgentProvider } from "@agent-weave/contracts"
import { AlertCircle, WifiOff } from "lucide-react"
import { useEffect, type PointerEvent } from "react"

import { ConfigOptionControls } from "@/features/conversations/components/configuration/config-option-controls"
import { PromptComposer } from "@/features/conversations/components/composer/prompt-composer"
import { MessageList } from "@/features/conversations/components/messages/message-list"
import { conversationController } from "@/features/conversations/lifecycle"
import { useConversationStore } from "@/features/conversations/store"

export function ConversationWindow({
  conversationId,
  provider,
  providerLabel,
  shortLabel,
  accent,
  title,
  workspace,
  onInteract,
}: {
  conversationId: string
  provider: AgentProvider
  providerLabel: string
  shortLabel: string
  accent: string
  title: string
  workspace: string
  onInteract: (event: PointerEvent<HTMLElement>) => void
}) {
  const view = useConversationStore((state) => state.conversations[conversationId])

  useEffect(() => {
    conversationController.connect(conversationId)
  }, [conversationId])

  const conversation = view?.conversation
  const activeRun = view?.runs.find((run) => run.status === "running" || run.status === "queued")
  const status = conversation?.status ?? (view?.loading ? "initializing" : "failed")

  return (
    <>
      <div className="agent-shape__header">
        <div className="agent-shape__avatar" style={{ backgroundColor: accent }}>
          {shortLabel}
        </div>
        <div className="agent-shape__identity">
          <strong>{title}</strong>
          <span>{providerLabel}</span>
        </div>
        <span className="agent-shape__status" data-status={status}>
          {statusLabel(status)}
        </span>
      </div>

      <div className="agent-window__interactive" onPointerDown={onInteract} onPointerUp={onInteract}>
        {conversation && <ConfigOptionControls conversation={conversation} />}
        {view ? (
          <MessageList conversationId={conversationId} view={view} />
        ) : (
          <div className="conversation-loading">
            <span className="conversation-loader" />
            Connecting to {provider}...
          </div>
        )}
        {view?.error && (
          <div className="conversation-error">
            <AlertCircle /> <span>{view.error}</span>
          </div>
        )}
        {view?.connectionStatus === "reconnecting" && (
          <div className="conversation-connection">
            <WifiOff />
            Reconnecting...
          </div>
        )}
        <PromptComposer
          activeRun={activeRun}
          conversationId={conversationId}
          disabled={!conversation || conversation.status === "initializing" || conversation.status === "failed"}
        />
      </div>

      <div className="agent-shape__meta">
        <span title={provider}>{provider}</span>
        <span title={workspace}>{workspace}</span>
      </div>
    </>
  )
}

function statusLabel(status: "initializing" | "ready" | "running" | "failed"): string {
  if (status === "initializing") return "Starting"
  if (status === "running") return "Working"
  if (status === "failed") return "Failed"
  return "Ready"
}
