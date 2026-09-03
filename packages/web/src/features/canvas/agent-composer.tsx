import { Bot, FolderOpen, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { AGENT_RUNNERS, AGENT_RUNNER_IDS, type AgentRunner } from "@/features/canvas/agent-options"
import { AgentRunnerIcon } from "@/features/canvas/agent-runner-icon"
import { localizeErrorPresentation, toErrorPresentation, type PresentableError } from "@/i18n"

export type AgentDraft = {
  runner: AgentRunner
  workspace: string
}

type AgentComposerProps = {
  onClose: () => void
  onCreate: (draft: AgentDraft) => Promise<void>
}

export function AgentComposer({ onClose, onCreate }: AgentComposerProps) {
  const { t } = useTranslation()
  const [runner, setRunner] = useState<AgentRunner>("codex")
  const [workspace, setWorkspace] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<PresentableError>()

  const selectRunner = (nextRunner: AgentRunner) => {
    setRunner(nextRunner)
  }

  const create = async () => {
    setCreating(true)
    setError(undefined)
    try {
      await onCreate({ runner, workspace: workspace.trim() })
    } catch (createError) {
      setError(toErrorPresentation(createError, "errors.fallbacks.createAgent"))
      setCreating(false)
    }
  }

  return (
    <section className="agent-composer" aria-label={t("agents.createLabel")}>
      <div className="agent-composer__heading">
        <div>
          <span className="agent-composer__icon">
            <Bot />
          </span>
          <div>
            <h2>{t("agents.new")}</h2>
            <p>{t("agents.chooseRunnerWorkspace")}</p>
          </div>
        </div>
        <Button size="icon-sm" variant="ghost" aria-label={t("common.close")} onClick={onClose}>
          <X />
        </Button>
      </div>

      <div className="agent-composer__field">
        <label>{t("agents.runner")}</label>
        <div className="agent-runner-grid">
          {AGENT_RUNNER_IDS.map((id) => {
            const item = AGENT_RUNNERS[id]
            const active = id === runner

            return (
              <button
                className="agent-runner-option"
                data-active={active}
                key={id}
                type="button"
                onClick={() => selectRunner(id)}
              >
                <AgentRunnerIcon className="agent-runner-option__icon" label={item.label} src={item.iconSrc} />
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="agent-composer__field">
        <label htmlFor="agent-workspace">{t("agents.workspace")}</label>
        <div className="agent-workspace-input">
          <FolderOpen />
          <input
            id="agent-workspace"
            value={workspace}
            onChange={(event) => setWorkspace(event.target.value)}
            placeholder={t("agents.workspacePlaceholder")}
          />
        </div>
      </div>

      {error && <p className="agent-composer__error">{localizeErrorPresentation(error, t)}</p>}

      <div className="agent-composer__actions">
        <Button disabled={creating} variant="ghost" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button disabled={!workspace.trim() || creating} onClick={() => void create()}>
          {creating ? t("agents.creating") : t("agents.create")}
        </Button>
      </div>
    </section>
  )
}
