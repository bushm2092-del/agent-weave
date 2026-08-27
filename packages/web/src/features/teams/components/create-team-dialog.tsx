import { FolderOpen, Plus, Trash2, Users, X } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { AGENT_RUNNERS, AGENT_RUNNER_IDS, type AgentRunner } from "@/features/canvas/agent-options"
import { AgentRunnerIcon } from "@/features/canvas/agent-runner-icon"

export type TeamDraft = {
  name: string
  workspace: string
  leader: { name: string; runner: AgentRunner }
  members: Array<{ name: string; runner: AgentRunner }>
}

export function CreateTeamDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (draft: TeamDraft) => Promise<void>
}) {
  const [name, setName] = useState("Agent team")
  const [workspace, setWorkspace] = useState("")
  const [leaderName, setLeaderName] = useState("Lead")
  const [leaderRunner, setLeaderRunner] = useState<AgentRunner>("codex")
  const [members, setMembers] = useState<TeamDraft["members"]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string>()
  const titleId = useId()

  const create = async () => {
    if (creating) return
    setCreating(true)
    setError(undefined)
    try {
      await onCreate({
        name: name.trim(),
        workspace: workspace.trim(),
        leader: { name: leaderName.trim(), runner: leaderRunner },
        members: members.map((member) => ({ ...member, name: member.name.trim() })),
      })
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create the team.")
      setCreating(false)
    }
  }

  return (
    <section aria-busy={creating} aria-labelledby={titleId} className="agent-composer team-composer" role="dialog">
      <div className="agent-composer__heading">
        <div>
          <span className="agent-composer__icon">
            <Users />
          </span>
          <div>
            <h2 id={titleId}>New agent team</h2>
            <p>Create a leader and shared workspace.</p>
          </div>
        </div>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Close" disabled={creating} onClick={onClose}>
          <X />
        </Button>
      </div>

      <div className="team-composer__row">
        <label>
          Team name
          <input disabled={creating} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Leader name
          <input disabled={creating} value={leaderName} onChange={(event) => setLeaderName(event.target.value)} />
        </label>
      </div>

      <div className="agent-composer__field">
        <label>Leader runner</label>
        <RunnerPicker disabled={creating} value={leaderRunner} onChange={setLeaderRunner} />
      </div>

      <div className="agent-composer__field">
        <label htmlFor="team-workspace">Shared workspace</label>
        <div className="agent-workspace-input">
          <FolderOpen />
          <input
            id="team-workspace"
            disabled={creating}
            value={workspace}
            onChange={(event) => setWorkspace(event.target.value)}
            placeholder="/path/to/project"
          />
        </div>
      </div>

      <div className="team-composer__members">
        <div>
          <label>Initial teammates</label>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={creating}
            onClick={() =>
              setMembers((current) => [...current, { name: `Teammate ${current.length + 1}`, runner: "codex" }])
            }
          >
            <Plus /> Add
          </Button>
        </div>
        {members.map((member, index) => (
          <div className="team-composer__member" key={index}>
            <input
              disabled={creating}
              value={member.name}
              aria-label={`Teammate ${index + 1} name`}
              onChange={(event) =>
                setMembers((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
            />
            <select
              disabled={creating}
              value={member.runner}
              aria-label={`Teammate ${index + 1} runner`}
              onChange={(event) =>
                setMembers((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, runner: event.target.value as AgentRunner } : item,
                  ),
                )
              }
            >
              {AGENT_RUNNER_IDS.map((runner) => (
                <option key={runner} value={runner}>
                  {AGENT_RUNNERS[runner].label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label="Remove teammate"
              disabled={creating}
              onClick={() => setMembers((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {members.length === 0 && <p>No teammates yet. The leader can add them later.</p>}
      </div>

      {error && (
        <p className="agent-composer__error" role="alert">
          {error}
        </p>
      )}
      <div className="agent-composer__actions">
        <Button type="button" disabled={creating} variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={
            !name.trim() ||
            !leaderName.trim() ||
            !workspace.trim() ||
            members.some((member) => !member.name.trim()) ||
            creating
          }
          onClick={() => void create()}
        >
          {creating ? "Creating..." : "Create team"}
        </Button>
      </div>
    </section>
  )
}

function RunnerPicker({
  disabled,
  value,
  onChange,
}: {
  disabled: boolean
  value: AgentRunner
  onChange: (runner: AgentRunner) => void
}) {
  return (
    <div aria-label="Leader runner" className="agent-runner-grid" role="group">
      {AGENT_RUNNER_IDS.map((id) => {
        const runner = AGENT_RUNNERS[id]
        return (
          <button
            aria-pressed={id === value}
            className="agent-runner-option"
            data-active={id === value}
            disabled={disabled}
            key={id}
            type="button"
            onClick={() => onChange(id)}
          >
            <AgentRunnerIcon className="agent-runner-option__icon" label={runner.label} src={runner.iconSrc} />
            {runner.label}
          </button>
        )
      })}
    </div>
  )
}
