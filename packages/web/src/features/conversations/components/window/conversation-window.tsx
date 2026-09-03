import type { AgentProvider } from "@agent-weave/contracts"
import { AlertCircle, Maximize2, Minimize2, WifiOff } from "lucide-react"
import { useEffect, type PointerEvent } from "react"
import { useTranslation } from "react-i18next"

import { AgentRunnerIcon } from "@/features/canvas/agent-runner-icon"
import { ConfigOptionControls } from "@/features/conversations/components/configuration/config-option-controls"
import { PromptComposer } from "@/features/conversations/components/composer/prompt-composer"
import { MessageList } from "@/features/conversations/components/messages/message-list"
import { conversationController } from "@/features/conversations/lifecycle"
import { useConversationStore } from "@/features/conversations/store"
import { localizeErrorPresentation } from "@/i18n"

export function ConversationWindow({
  conversationId,
  provider,
  providerLabel,
  iconSrc,
  title,
  workspace,
  onInteract,
  fullscreen,
  onToggleFullscreen,
  teamTarget,
}: {
  conversationId: string
  provider: AgentProvider
  providerLabel: string
  iconSrc: string
  title: string
  workspace: string
  onInteract: (event: PointerEvent<HTMLElement>) => void
  fullscreen: boolean
  onToggleFullscreen: () => void
  teamTarget?: { teamId: string; slotId: string }
}) {
  const { t } = useTranslation()
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
        <AgentRunnerIcon className="agent-shape__avatar" label={providerLabel} src={iconSrc} />
        <div className="agent-shape__identity">
          <strong>{title}</strong>
          <span>{providerLabel}</span>
        </div>
        <span className="agent-shape__status" data-status={status}>
          {statusLabel(status, t)}
        </span>
        <button
          className="agent-shape__fullscreen-button"
          type="button"
          aria-label={fullscreen ? t("conversations.exitFullscreen") : t("conversations.openFullscreen")}
          title={fullscreen ? t("conversations.exitFullscreenEsc") : t("conversations.openFullscreenEsc")}
          onClick={onToggleFullscreen}
          onPointerDown={onInteract}
          onPointerUp={onInteract}
        >
          {fullscreen ? <Minimize2 /> : <Maximize2 />}
        </button>
      </div>

      <div className="agent-window__interactive" onPointerDown={onInteract} onPointerUp={onInteract}>
        {conversation && <ConfigOptionControls conversation={conversation} />}
        {view ? (
          <MessageList conversationId={conversationId} view={view} />
        ) : (
          <div className="conversation-loading">
            <span className="conversation-loader" />
            {t("conversations.connectingTo", { provider })}
          </div>
        )}
        {view?.error && (
          <div className="conversation-error">
            <AlertCircle /> <span>{localizeErrorPresentation(view.error, t)}</span>
          </div>
        )}
        {view?.connectionStatus === "reconnecting" && (
          <div className="conversation-connection">
            <WifiOff />
            {t("conversations.reconnecting")}
          </div>
        )}
        <PromptComposer
          activeRun={activeRun}
          conversationId={conversationId}
          disabled={!conversation || conversation.status === "initializing" || conversation.status === "failed"}
          {...(teamTarget ? { teamTarget } : {})}
        />
      </div>

      <div className="agent-shape__meta">
        <span title={provider}>{provider}</span>
        <span title={workspace}>{workspace}</span>
      </div>
    </>
  )
}

function statusLabel(
  status: "initializing" | "ready" | "running" | "failed",
  t: ReturnType<typeof useTranslation>["t"],
): string {
  if (status === "initializing") return t("conversations.status.starting")
  if (status === "running") return t("conversations.status.working")
  if (status === "failed") return t("conversations.status.failed")
  return t("conversations.status.ready")
}
