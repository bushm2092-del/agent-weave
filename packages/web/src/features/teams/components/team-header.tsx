import { LoaderCircle, Play, Send, Square, Users } from "lucide-react"
import { useState, type PointerEvent } from "react"
import type { Editor } from "tldraw"
import { teamApi } from "@/features/teams/api"
import { useTeamStore } from "@/features/teams/store"
import { ApiClientError } from "@/lib/api"

export function TeamHeader({ editor, teamId, fallbackName }: { editor: Editor; teamId: string; fallbackName: string }) {
  const view = useTeamStore((state) => state.teams[teamId])
  const [composing, setComposing] = useState(false)
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [cancellingRunId, setCancellingRunId] = useState<string>()
  const [error, setError] = useState<string>()
  const team = view?.team
  const activeRun = team?.activeRun
  const cancelling = Boolean(activeRun && cancellingRunId === activeRun.id)

  const handlePointer = (event: PointerEvent<HTMLElement>) => editor.markEventAsHandled(event)
  const send = async () => {
    const content = message.trim()
    if (!content || !team || submitting) return
    setSubmitting(true)
    setError(undefined)
    try {
      await teamApi.sendMessage(team.id, { message: content, attachments: [], clientMessageId: crypto.randomUUID() })
      setMessage("")
      setComposing(false)
    } catch (requestError) {
      setError(requestError instanceof ApiClientError ? requestError.message : "Unable to start the team run.")
    } finally {
      setSubmitting(false)
    }
  }

  const cancel = async () => {
    if (!activeRun || cancelling) return
    setCancellingRunId(activeRun.id)
    setError(undefined)
    try {
      await teamApi.cancelRun(teamId, activeRun.id)
    } catch (requestError) {
      setCancellingRunId(undefined)
      setError(requestError instanceof ApiClientError ? requestError.message : "Unable to cancel the team run.")
    }
  }

  return (
    <div className="agent-team-shape__header">
      <div className="agent-team-shape__identity">
        <strong>{team?.name ?? fallbackName}</strong>
        <span>
          <Users /> {team?.members.length ?? 0} members ·{" "}
          {team?.tasks.filter((task) => task.status === "completed").length ?? 0}/{team?.tasks.length ?? 0} tasks ·
          Shared workspace
        </span>
      </div>
      <div className="agent-team-shape__controls" onPointerDown={handlePointer} onPointerUp={handlePointer}>
        <span
          aria-live="polite"
          className="agent-team-shape__status"
          data-status={activeRun?.status ?? team?.sessionStatus ?? "starting"}
        >
          {statusLabel(activeRun?.status ?? team?.sessionStatus)}
        </span>
        {activeRun ? (
          <button
            aria-label="Cancel team run"
            disabled={cancelling || activeRun.status === "cancelling"}
            type="button"
            onClick={() => void cancel()}
          >
            <Square />
          </button>
        ) : (
          <button
            aria-label="Run team"
            disabled={!team || team.sessionStatus !== "ready"}
            type="button"
            onClick={() => setComposing((open) => !open)}
          >
            <Play />
          </button>
        )}
      </div>
      {composing && (
        <div
          aria-busy={submitting}
          className="team-run-composer"
          onPointerDown={handlePointer}
          onPointerUp={handlePointer}
        >
          <textarea
            aria-label="Team goal"
            autoFocus
            rows={3}
            placeholder="Give the team a goal..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <button
            aria-label="Send team goal"
            disabled={!message.trim() || submitting}
            type="button"
            onClick={() => void send()}
          >
            {submitting ? <LoaderCircle className="animate-spin" /> : <Send />}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      {!composing && error && (
        <p className="team-run-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function statusLabel(status?: string): string {
  if (!status || status === "starting" || status === "accepted") return "Starting"
  if (status === "ready") return "Ready"
  if (status === "running") return "Running"
  if (status === "cancelling") return "Stopping"
  if (status === "failed") return "Failed"
  return status[0]!.toUpperCase() + status.slice(1)
}
