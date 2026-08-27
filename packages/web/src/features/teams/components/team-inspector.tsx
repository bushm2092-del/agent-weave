import { Activity, Check, ListTodo, Plus, Trash2, Users, X } from "lucide-react"
import { useId, useState, type KeyboardEvent, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { AGENT_RUNNERS, AGENT_RUNNER_IDS, type AgentRunner } from "@/features/canvas/agent-options"
import { AgentRunnerIcon } from "@/features/canvas/agent-runner-icon"
import { teamApi } from "@/features/teams/api"
import { teamController } from "@/features/teams/lifecycle"
import { useTeamStore } from "@/features/teams/store"
import { ApiClientError } from "@/lib/api"

type InspectorTab = "members" | "tasks" | "activity"

const inspectorTabs: InspectorTab[] = ["members", "tasks", "activity"]

export function TeamInspector({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const view = useTeamStore((state) => state.teams[teamId])
  const [tab, setTab] = useState<InspectorTab>("members")
  const [adding, setAdding] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [name, setName] = useState("")
  const [runner, setRunner] = useState<AgentRunner>("codex")
  const [removingSlotIds, setRemovingSlotIds] = useState<Set<string>>(() => new Set())
  const [resolvingRequestIds, setResolvingRequestIds] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<string>()
  const inspectorId = useId()
  const team = view?.team

  const refresh = () => {
    void teamController.refresh(teamId).catch(() => undefined)
  }

  const addMember = async () => {
    if (!name.trim() || addingMember) return
    setAddingMember(true)
    setError(undefined)
    try {
      await teamApi.addMember(teamId, { name: name.trim(), agent: AGENT_RUNNERS[runner].provider })
      setName("")
      setAdding(false)
      refresh()
    } catch (requestError) {
      setError(requestError instanceof ApiClientError ? requestError.message : "Unable to add the member.")
    } finally {
      setAddingMember(false)
    }
  }

  const removeMember = async (slotId: string) => {
    if (removingSlotIds.has(slotId)) return
    setRemovingSlotIds((current) => new Set(current).add(slotId))
    setError(undefined)
    try {
      await teamApi.removeMember(teamId, slotId)
      refresh()
    } catch (requestError) {
      setRemovingSlotIds((current) => without(current, slotId))
      setError(requestError instanceof ApiClientError ? requestError.message : "Unable to remove the member.")
    }
  }

  const resolveSpawnRequest = async (requestId: string, approve: boolean) => {
    if (resolvingRequestIds.has(requestId)) return
    setResolvingRequestIds((current) => new Set(current).add(requestId))
    setError(undefined)
    try {
      if (approve) await teamApi.approveSpawnRequest(teamId, requestId)
      else await teamApi.rejectSpawnRequest(teamId, requestId)
      refresh()
    } catch (requestError) {
      setResolvingRequestIds((current) => without(current, requestId))
      setError(requestError instanceof ApiClientError ? requestError.message : "Unable to resolve the spawn request.")
    }
  }

  const selectAdjacentTab = (event: KeyboardEvent<HTMLButtonElement>, currentTab: InspectorTab) => {
    let nextIndex: number | undefined
    const currentIndex = inspectorTabs.indexOf(currentTab)
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % inspectorTabs.length
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + inspectorTabs.length) % inspectorTabs.length
    if (event.key === "Home") nextIndex = 0
    if (event.key === "End") nextIndex = inspectorTabs.length - 1
    if (nextIndex === undefined) return
    event.preventDefault()
    const nextTab = inspectorTabs[nextIndex]!
    setTab(nextTab)
    requestAnimationFrame(() => document.getElementById(tabButtonId(inspectorId, nextTab))?.focus())
  }

  const visibleError = error ?? view?.error

  return (
    <aside aria-label={`${team?.name ?? "Agent team"} inspector`} className="team-inspector">
      <div className="team-inspector__header">
        <div>
          <strong>{team?.name ?? "Agent team"}</strong>
          <span aria-live="polite">{view?.connectionStatus ?? "connecting"}</span>
        </div>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Close team inspector" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div aria-label="Team details" className="team-inspector__tabs" role="tablist">
        <button
          aria-controls={tabPanelId(inspectorId, "members")}
          aria-selected={tab === "members"}
          data-active={tab === "members"}
          id={tabButtonId(inspectorId, "members")}
          role="tab"
          tabIndex={tab === "members" ? 0 : -1}
          type="button"
          onClick={() => setTab("members")}
          onKeyDown={(event) => selectAdjacentTab(event, "members")}
        >
          <Users /> Members
        </button>
        <button
          aria-controls={tabPanelId(inspectorId, "tasks")}
          aria-selected={tab === "tasks"}
          data-active={tab === "tasks"}
          id={tabButtonId(inspectorId, "tasks")}
          role="tab"
          tabIndex={tab === "tasks" ? 0 : -1}
          type="button"
          onClick={() => setTab("tasks")}
          onKeyDown={(event) => selectAdjacentTab(event, "tasks")}
        >
          <ListTodo /> Tasks
        </button>
        <button
          aria-controls={tabPanelId(inspectorId, "activity")}
          aria-selected={tab === "activity"}
          data-active={tab === "activity"}
          id={tabButtonId(inspectorId, "activity")}
          role="tab"
          tabIndex={tab === "activity" ? 0 : -1}
          type="button"
          onClick={() => setTab("activity")}
          onKeyDown={(event) => selectAdjacentTab(event, "activity")}
        >
          <Activity /> Activity
        </button>
      </div>

      <div
        aria-labelledby={tabButtonId(inspectorId, tab)}
        className="team-inspector__body"
        id={tabPanelId(inspectorId, tab)}
        role="tabpanel"
        tabIndex={0}
      >
        {tab === "members" && (
          <>
            <div className="team-inspector__section-title">
              <span>{team?.members.length ?? 0} members</span>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={!team || team.members.length >= 8}
                onClick={() => setAdding((open) => !open)}
              >
                <Plus /> Add
              </Button>
            </div>
            {team?.spawnRequests
              .filter((request) => request.status === "pending")
              .map((request) => {
                const resolving = resolvingRequestIds.has(request.id)
                return (
                  <div
                    aria-busy={resolving}
                    aria-label={`Spawn request for ${request.name}`}
                    className="team-spawn-request"
                    key={request.id}
                    role="group"
                  >
                    <div>
                      <strong>Add {request.name}?</strong>
                      <span>
                        {AGENT_RUNNERS[providerRunner(request.agent)].label} · Requested by{" "}
                        {team.members.find((member) => member.slotId === request.requestedBySlotId)?.name ?? "Leader"}
                      </span>
                    </div>
                    <button
                      aria-label={`Approve ${request.name}`}
                      disabled={resolving}
                      type="button"
                      onClick={() => void resolveSpawnRequest(request.id, true)}
                    >
                      <Check />
                    </button>
                    <button
                      aria-label={`Reject ${request.name}`}
                      disabled={resolving}
                      type="button"
                      onClick={() => void resolveSpawnRequest(request.id, false)}
                    >
                      <X />
                    </button>
                  </div>
                )
              })}
            {adding && (
              <form
                aria-busy={addingMember}
                className="team-member-add"
                onSubmit={(event) => {
                  event.preventDefault()
                  void addMember()
                }}
              >
                <label className="sr-only" htmlFor={`${inspectorId}-member-name`}>
                  Member name
                </label>
                <input
                  autoFocus
                  disabled={addingMember}
                  id={`${inspectorId}-member-name`}
                  placeholder="Member name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <label className="sr-only" htmlFor={`${inspectorId}-member-runner`}>
                  Member runner
                </label>
                <select
                  disabled={addingMember}
                  id={`${inspectorId}-member-runner`}
                  value={runner}
                  onChange={(event) => setRunner(event.target.value as AgentRunner)}
                >
                  {AGENT_RUNNER_IDS.map((id) => (
                    <option key={id} value={id}>
                      {AGENT_RUNNERS[id].label}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" disabled={!name.trim() || addingMember}>
                  {addingMember ? "Adding..." : "Add"}
                </Button>
              </form>
            )}
            <div className="team-member-list">
              {team?.members.map((member) => {
                const runnerInfo = AGENT_RUNNERS[providerRunner(member.agent)]
                const status = member.runtimeStatus === "ready" ? member.workStatus : member.runtimeStatus
                const removing = removingSlotIds.has(member.slotId)
                return (
                  <div className="team-member-row" key={member.slotId}>
                    <AgentRunnerIcon
                      className="team-member-row__icon"
                      label={runnerInfo.label}
                      src={runnerInfo.iconSrc}
                    />
                    <div>
                      <strong>{member.name}</strong>
                      <span>
                        {member.role} · {runnerInfo.label}
                      </span>
                    </div>
                    <span
                      aria-label={`${member.name} status: ${removing ? "removing" : status}`}
                      className="team-member-row__status"
                      data-status={removing ? "removing" : status}
                    >
                      {removing ? "removing" : status}
                    </span>
                    {member.role !== "leader" && (
                      <button
                        aria-label={`Remove ${member.name}`}
                        disabled={removing}
                        type="button"
                        onClick={() => void removeMember(member.slotId)}
                      >
                        <Trash2 />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {tab === "tasks" && (
          <div className="team-task-list">
            {team?.tasks.length ? (
              team.tasks.map((task) => (
                <div className="team-task-row" key={task.id}>
                  <span data-status={task.status} />
                  <div>
                    <strong>{task.subject}</strong>
                    <p>{task.description || "No description"}</p>
                    <small>
                      {task.status.replace("_", " ")}
                      {task.ownerSlotId
                        ? ` · ${team.members.find((member) => member.slotId === task.ownerSlotId)?.name ?? "Unassigned"}`
                        : " · Unassigned"}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<ListTodo />}
                title="No team tasks"
                text="Tasks created by team agents will appear here."
              />
            )}
          </div>
        )}

        {tab === "activity" && (
          <div className="team-activity-list">
            {view?.events.length ? (
              [...view.events].reverse().map((event) => (
                <div className="team-activity-row" key={event.id}>
                  <span />
                  <div>
                    <strong>{activityLabel(event.type)}</strong>
                    <small>
                      {new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<Activity />}
                title="No activity yet"
                text="Team runs and coordination events will appear here."
              />
            )}
          </div>
        )}
        {visibleError && (
          <p className="team-inspector__error" role="alert">
            {visibleError}
          </p>
        )}
      </div>
    </aside>
  )
}

function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="team-inspector__empty">
      {icon}
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  )
}

function without(values: Set<string>, value: string): Set<string> {
  const next = new Set(values)
  next.delete(value)
  return next
}

function tabButtonId(inspectorId: string, tab: InspectorTab): string {
  return `${inspectorId}-${tab}-tab`
}

function tabPanelId(inspectorId: string, tab: InspectorTab): string {
  return `${inspectorId}-${tab}-panel`
}

function providerRunner(provider: "claude" | "codex" | "pi" | "opencode"): AgentRunner {
  return provider === "claude" ? "claude-code" : provider
}

function activityLabel(type: string): string {
  return type
    .replace(/^team\./, "")
    .replaceAll(".", " ")
    .replaceAll("-", " ")
}
