import type { MessageAttachment, Run } from "@agent-weave/contracts"
import { FileCode2, ImagePlus, Send, Square, X } from "lucide-react"
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"

import { conversationApi } from "@/features/conversations/api"
import { conversationStore } from "@/features/conversations/store"
import { teamApi } from "@/features/teams"
import { localizeErrorPresentation, ownedErrorPresentation, toErrorPresentation, type PresentableError } from "@/i18n"

export function PromptComposer({
  conversationId,
  activeRun,
  disabled,
  teamTarget,
}: {
  conversationId: string
  activeRun?: Run
  disabled: boolean
  teamTarget?: { teamId: string; slotId: string }
}) {
  const { t } = useTranslation()
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const [workspacePath, setWorkspacePath] = useState("")
  const [showWorkspacePath, setShowWorkspacePath] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<PresentableError>()
  const imageInput = useRef<HTMLInputElement>(null)

  const send = async () => {
    const content = message.trim()
    if (!content || disabled || (!teamTarget && activeRun) || submitting) return
    setSubmitting(true)
    setError(undefined)
    try {
      if (teamTarget) {
        await teamApi.sendMemberMessage(teamTarget.teamId, teamTarget.slotId, {
          message: content,
          attachments,
          clientMessageId: crypto.randomUUID(),
        })
      } else {
        const run = await conversationApi.createRun(conversationId, { message: content, attachments })
        conversationStore.getState().upsertRun(run)
      }
      setMessage("")
      setAttachments([])
    } catch (requestError) {
      setError(toErrorPresentation(requestError, "errors.fallbacks.sendMessage"))
    } finally {
      setSubmitting(false)
    }
  }

  const stop = async () => {
    if (!activeRun) return
    setError(undefined)
    try {
      const run = await conversationApi.cancelRun(conversationId, activeRun.id)
      conversationStore.getState().upsertRun(run)
    } catch (requestError) {
      setError(toErrorPresentation(requestError, "errors.fallbacks.stopRun"))
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void send()
  }

  const addWorkspaceFile = () => {
    const path = workspacePath.trim()
    if (!path) return
    setAttachments((current) => [...current, { type: "workspace_file", path }])
    setWorkspacePath("")
    setShowWorkspacePath(false)
  }

  const addImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      setError({ fallbackKey: "conversations.imageTooLarge" })
      return
    }
    try {
      const dataUrl = await readAsDataUrl(file)
      setAttachments((current) => [
        ...current,
        { type: "image", mediaType: file.type || "image/png", data: dataUrl.split(",")[1], name: file.name },
      ])
    } catch (readError) {
      setError(toErrorPresentation(readError, "conversations.readImageError"))
    }
  }

  return (
    <div className="prompt-composer">
      {!!attachments.length && (
        <div className="prompt-composer__attachments">
          {attachments.map((attachment, index) => (
            <span key={`${attachment.type}-${index}`}>
              {attachment.type === "image" ? <ImagePlus /> : <FileCode2 />}
              {attachment.type === "image" ? attachment.name || t("common.image") : attachment.path}
              <button
                aria-label={t("conversations.removeAttachment")}
                type="button"
                onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              >
                <X />
              </button>
            </span>
          ))}
        </div>
      )}
      {showWorkspacePath && (
        <div className="prompt-composer__workspace-file">
          <input
            autoFocus
            placeholder={t("conversations.pathPlaceholder")}
            value={workspacePath}
            onChange={(event) => setWorkspacePath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                addWorkspaceFile()
              }
            }}
          />
          <button disabled={!workspacePath.trim()} type="button" onClick={addWorkspaceFile}>
            {t("common.add")}
          </button>
        </div>
      )}
      <div className="prompt-composer__input">
        <textarea
          aria-label={t("conversations.messageAgent")}
          disabled={disabled}
          placeholder={
            disabled
              ? t("conversations.waitingPlaceholder")
              : teamTarget
                ? t("conversations.memberPlaceholder")
                : t("conversations.agentPlaceholder")
          }
          rows={2}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="prompt-composer__toolbar">
          <div>
            <button
              aria-label={t("conversations.attachWorkspaceFile")}
              type="button"
              onClick={() => setShowWorkspacePath((open) => !open)}
            >
              <FileCode2 />
            </button>
            <button
              aria-label={t("conversations.attachImage")}
              type="button"
              onClick={() => imageInput.current?.click()}
            >
              <ImagePlus />
            </button>
            <input accept="image/*" hidden ref={imageInput} type="file" onChange={(event) => void addImage(event)} />
          </div>
          {activeRun && (
            <button
              className="prompt-composer__stop"
              aria-label={t("conversations.stopRun")}
              type="button"
              onClick={() => void stop()}
            >
              <Square />
            </button>
          )}
          {(!activeRun || teamTarget) && (
            <button
              className="prompt-composer__send"
              aria-label={t("conversations.send")}
              disabled={!message.trim() || disabled || submitting}
              type="button"
              onClick={() => void send()}
            >
              <Send />
            </button>
          )}
        </div>
      </div>
      {error && <p className="prompt-composer__error">{localizeErrorPresentation(error, t)}</p>}
    </div>
  )
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? ownedErrorPresentation("conversations.readImageError"))
    reader.readAsDataURL(file)
  })
}
