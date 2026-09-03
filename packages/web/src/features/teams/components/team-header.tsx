import { LoaderCircle, Play, Send, Square, Users } from "lucide-react"
import { useState, type PointerEvent } from "react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import type { Editor } from "tldraw"
import { teamApi } from "@/features/teams/api"
import { useTeamStore } from "@/features/teams/store"
import { formatNumber, localizeErrorPresentation, toErrorPresentation, type PresentableError } from "@/i18n"

export function TeamHeader({ editor, teamId, fallbackName }: { editor: Editor; teamId: string; fallbackName: string }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en"
  const view = useTeamStore((state) => state.teams[teamId])
  const [composing, setComposing] = useState(false)
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [cancellingRunId, setCancellingRunId] = useState<string>()
  const [error, setError] = useState<PresentableError>()
  const team = view?.team
  const activeRun = team?.activeRun
  const cancelling = Boolean(activeRun && cancellingRunId === activeRun.id)
  const totalTasks = team?.tasks.length ?? 0
  const completedTasks = team?.tasks.filter((task) => task.status === "completed").length ?? 0

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
      setError(toErrorPresentation(requestError, "errors.fallbacks.startTeamRun"))
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
      setError(toErrorPresentation(requestError, "errors.fallbacks.cancelTeamRun"))
    }
  }

  return (
    <div className="agent-team-shape__header">
      <div className="agent-team-shape__identity">
        <strong>{team?.name ?? fallbackName}</strong>
        <span>
          <Users />{" "}
          {t("teams.memberCount", {
            count: team?.members.length ?? 0,
            formattedCount: formatNumber(team?.members.length ?? 0, locale),
          })}{" "}
          ·{" "}
          {t("teams.taskCount", {
            count: totalTasks,
            formattedCompleted: formatNumber(completedTasks, locale),
            formattedTotal: formatNumber(totalTasks, locale),
          })}{" "}
          · {t("teams.sharedWorkspace")}
        </span>
      </div>
      <div className="agent-team-shape__controls" onPointerDown={handlePointer} onPointerUp={handlePointer}>
        <span
          aria-live="polite"
          className="agent-team-shape__status"
          data-status={activeRun?.status ?? team?.sessionStatus ?? "starting"}
        >
          {statusLabel(activeRun?.status ?? team?.sessionStatus, t)}
        </span>
        {activeRun ? (
          <button
            aria-label={t("teams.cancelRun")}
            disabled={cancelling || activeRun.status === "cancelling"}
            type="button"
            onClick={() => void cancel()}
          >
            <Square />
          </button>
        ) : (
          <button
            aria-label={t("teams.run")}
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
            aria-label={t("teams.goal")}
            autoFocus
            rows={3}
            placeholder={t("teams.goalPlaceholder")}
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
            aria-label={t("teams.sendGoal")}
            disabled={!message.trim() || submitting}
            type="button"
            onClick={() => void send()}
          >
            {submitting ? <LoaderCircle className="animate-spin" /> : <Send />}
          </button>
          {error && <p role="alert">{localizeErrorPresentation(error, t)}</p>}
        </div>
      )}
      {!composing && error && (
        <p className="team-run-error" role="alert">
          {localizeErrorPresentation(error, t)}
        </p>
      )}
    </div>
  )
}

function statusLabel(status: string | undefined, t: TFunction): string {
  if (!status) return t("teams.status.starting")
  if (
    status === "starting" ||
    status === "accepted" ||
    status === "ready" ||
    status === "running" ||
    status === "cancelling" ||
    status === "failed" ||
    status === "completed" ||
    status === "cancelled" ||
    status === "stopped"
  ) {
    return t(`teams.status.${status}`)
  }
  return status
}
