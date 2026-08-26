import type { MessageAttachment, Run } from "@agent-weave/contracts"
import { FileCode2, ImagePlus, Send, Square, X } from "lucide-react"
import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"

import { conversationApi } from "@/features/conversations/api"
import { conversationStore } from "@/features/conversations/store"
import { ApiClientError } from "@/lib/api"

export function PromptComposer({
  conversationId,
  activeRun,
  disabled,
}: {
  conversationId: string
  activeRun?: Run
  disabled: boolean
}) {
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<MessageAttachment[]>([])
  const [workspacePath, setWorkspacePath] = useState("")
  const [showWorkspacePath, setShowWorkspacePath] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const imageInput = useRef<HTMLInputElement>(null)

  const send = async () => {
    const content = message.trim()
    if (!content || disabled || activeRun || submitting) return
    setSubmitting(true)
    setError(undefined)
    try {
      const run = await conversationApi.createRun(conversationId, { message: content, attachments })
      conversationStore.getState().upsertRun(run)
      setMessage("")
      setAttachments([])
    } catch (requestError) {
      setError(requestError instanceof ApiClientError ? requestError.message : "Unable to send the message.")
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
      setError(requestError instanceof ApiClientError ? requestError.message : "Unable to stop the run.")
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
      setError("Images must be smaller than 20 MB.")
      return
    }
    const dataUrl = await readAsDataUrl(file)
    setAttachments((current) => [
      ...current,
      { type: "image", mediaType: file.type || "image/png", data: dataUrl.split(",")[1], name: file.name },
    ])
  }

  return (
    <div className="prompt-composer">
      {!!attachments.length && (
        <div className="prompt-composer__attachments">
          {attachments.map((attachment, index) => (
            <span key={`${attachment.type}-${index}`}>
              {attachment.type === "image" ? <ImagePlus /> : <FileCode2 />}
              {attachment.type === "image" ? attachment.name || "Image" : attachment.path}
              <button
                aria-label="Remove attachment"
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
            placeholder="Path relative to workspace"
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
            Add
          </button>
        </div>
      )}
      <div className="prompt-composer__input">
        <textarea
          aria-label="Message agent"
          disabled={disabled}
          placeholder={disabled ? "Waiting for agent..." : "Ask this agent anything..."}
          rows={2}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="prompt-composer__toolbar">
          <div>
            <button
              aria-label="Attach workspace file"
              type="button"
              onClick={() => setShowWorkspacePath((open) => !open)}
            >
              <FileCode2 />
            </button>
            <button aria-label="Attach image" type="button" onClick={() => imageInput.current?.click()}>
              <ImagePlus />
            </button>
            <input accept="image/*" hidden ref={imageInput} type="file" onChange={(event) => void addImage(event)} />
          </div>
          {activeRun ? (
            <button className="prompt-composer__stop" aria-label="Stop run" type="button" onClick={() => void stop()}>
              <Square />
            </button>
          ) : (
            <button
              className="prompt-composer__send"
              aria-label="Send message"
              disabled={!message.trim() || disabled || submitting}
              type="button"
              onClick={() => void send()}
            >
              <Send />
            </button>
          )}
        </div>
      </div>
      {error && <p className="prompt-composer__error">{error}</p>}
    </div>
  )
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read the image."))
    reader.readAsDataURL(file)
  })
}
