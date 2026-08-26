import { Bot, FolderOpen, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  AGENT_RUNNERS,
  AGENT_RUNNER_IDS,
  type AgentRunner,
} from '@/features/canvas/agent-options'

export type AgentDraft = {
  runner: AgentRunner
  model: string
  workspace: string
}

type AgentComposerProps = {
  onClose: () => void
  onCreate: (draft: AgentDraft) => void
}

export function AgentComposer({ onClose, onCreate }: AgentComposerProps) {
  const [runner, setRunner] = useState<AgentRunner>('codex')
  const models = useMemo(() => AGENT_RUNNERS[runner].models, [runner])
  const [model, setModel] = useState<string>(AGENT_RUNNERS.codex.models[0])
  const [workspace, setWorkspace] = useState('/workspace')

  const selectRunner = (nextRunner: AgentRunner) => {
    setRunner(nextRunner)
    setModel(AGENT_RUNNERS[nextRunner].models[0])
  }

  return (
    <section className="agent-composer" aria-label="Create agent">
      <div className="agent-composer__heading">
        <div>
          <span className="agent-composer__icon"><Bot /></span>
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
        <label htmlFor="agent-model">Model</label>
        <select id="agent-model" value={model} onChange={(event) => setModel(event.target.value)}>
          {models.map((item) => <option key={item}>{item}</option>)}
        </select>
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

      <div className="agent-composer__actions">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          disabled={!workspace.trim()}
          onClick={() => onCreate({ runner, model, workspace: workspace.trim() })}
        >
          Create agent
        </Button>
      </div>
    </section>
  )
}
