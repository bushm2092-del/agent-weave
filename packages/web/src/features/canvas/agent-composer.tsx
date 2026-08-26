import { Bot, FolderOpen, X } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { AGENT_RUNNERS, AGENT_RUNNER_IDS, type AgentRunner } from "@/features/canvas/agent-options"

export type AgentDraft = {
  runner: AgentRunner
  workspace: string
}

type AgentComposerProps = {
  onClose: () => void
  onCreate: (draft: AgentDraft) => Promise<void>
}

export function AgentComposer({ onClose, onCreate }: AgentComposerProps) {
  const [runner, setRunner] = useState<AgentRunner>("codex")
  const [workspace, setWorkspace] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string>()

  const selectRunner = (nextRunner: AgentRunner) => {
    setRunner(nextRunner)
  }

  const create = async () => {
    setCreating(true)
    setError(undefined)
    try {
      await onCreate({ runner, workspace: workspace.trim() })
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create the agent.")
      setCreating(false)
    }
  }

  return (
    <section className="agent-composer" aria-label="Create agent">
      <div className="agent-composer__heading">
        <div>
          <span className="agent-composer__icon">
            <Bot />
          </span>
          <div>
            <h2>New agent</h2>
            <p>Choose a runner and workspace.</p>
          </div>
        </div>
        <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={onClose}>
          <X />
        </Button>
      </div>

      <div className="agent-composer__field">
        <label>Agent runner</label>
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
                <span style={{ backgroundColor: item.accent }}>{item.shortLabel}</span>
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="agent-composer__field">
        <label htmlFor="agent-workspace">Workspace</label>
        <div className="agent-workspace-input">
          <FolderOpen />
          <input
            id="agent-workspace"
            value={workspace}
            onChange={(event) => setWorkspace(event.target.value)}
            placeholder="/path/to/project"
          />
        </div>
      </div>

      {error && <p className="agent-composer__error">{error}</p>}

      <div className="agent-composer__actions">
        <Button disabled={creating} variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!workspace.trim() || creating} onClick={() => void create()}>
          {creating ? "Creating..." : "Create agent"}
        </Button>
      </div>
    </section>
  )
}
