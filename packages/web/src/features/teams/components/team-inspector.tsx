import type { RolePreset, TeamEventType } from "@agent-weave/contracts"
import type { TFunction } from "i18next"
import { Activity, Check, ListTodo, Plus, Trash2, Users, X } from "lucide-react"
import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { AGENT_RUNNERS, AGENT_RUNNER_IDS, type AgentRunner } from "@/features/canvas/agent-options"
import { AgentRunnerIcon } from "@/features/canvas/agent-runner-icon"
import { rolePresetApi } from "@/features/role-presets"
import { teamApi } from "@/features/teams/api"
import { teamController } from "@/features/teams/lifecycle"
import { useTeamStore } from "@/features/teams/store"
import {
  formatNumber,
  formatTime,
  localizeErrorPresentation,
  localizeRolePreset,
  toErrorPresentation,
  type PresentableError,
} from "@/i18n"

type InspectorTab = "members" | "tasks" | "activity"

const inspectorTabs: InspectorTab[] = ["members", "tasks", "activity"]

export function TeamInspector({ teamId, onClose }: { teamId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const view = useTeamStore((state) => state.teams[teamId])
  const [tab, setTab] = useState<InspectorTab>("members")
  const [adding, setAdding] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [name, setName] = useState("")
  const [runner, setRunner] = useState<AgentRunner>("codex")
  const [rolePresetId, setRolePresetId] = useState("")
  const [rolePresets, setRolePresets] = useState<RolePreset[]>([])
  const [removingSlotIds, setRemovingSlotIds] = useState<Set<string>>(() => new Set())
  const [resolvingRequestIds, setResolvingRequestIds] = useState<Set<string>>(() => new Set())
  const [error, setError] = useState<PresentableError>()
  const inspectorId = useId()
  const team = view?.team
  const locale = i18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en"

  useEffect(() => {
    void rolePresetApi
      .list()
      .then(setRolePresets)
      .catch(() => undefined)
  }, [])

  const refresh = () => {
    void teamController.refresh(teamId).catch(() => undefined)
  }

  const addMember = async () => {
    if (!name.trim() || addingMember) return
    setAddingMember(true)
    setError(undefined)
    try {
      await teamApi.addMember(teamId, {
        name: name.trim(),
        agent: AGENT_RUNNERS[runner].provider,
        ...(rolePresetId ? { rolePresetId } : {}),
      })
      setName("")
      setRolePresetId("")
      setAdding(false)
      refresh()
    } catch (requestError) {
      setError(toErrorPresentation(requestError, "errors.fallbacks.addTeamMember"))
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
      setError(toErrorPresentation(requestError, "errors.fallbacks.removeTeamMember"))
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
      setError(toErrorPresentation(requestError, "errors.fallbacks.resolveSpawnRequest"))
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

  const visibleError = localizeErrorPresentation(error ?? view?.error, t)

  return (
    <aside
      aria-label={t("teams.inspector", { name: team?.name ?? t("teams.defaults.teamName") })}
      className="team-inspector"
    >
      <div className="team-inspector__header">
        <div>
          <strong>{team?.name ?? t("teams.defaults.teamName")}</strong>
          <span aria-live="polite">{connectionLabel(view?.connectionStatus, t)}</span>
        </div>
        <Button type="button" size="icon-sm" variant="ghost" aria-label={t("teams.closeInspector")} onClick={onClose}>
          <X />
        </Button>
      </div>
      <div aria-label={t("teams.details")} className="team-inspector__tabs" role="tablist">
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
          <Users /> {t("teams.members")}
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
          <ListTodo /> {t("teams.tasks")}
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
          <Activity /> {t("teams.activity")}
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
              <span>
                {t("teams.memberCount", {
                  count: team?.members.length ?? 0,
                  formattedCount: formatNumber(team?.members.length ?? 0, locale),
                })}
              </span>
              <Button
                type="button"
                size="xs"
                variant="outline"
                disabled={!team || team.members.length >= 8}
                onClick={() => setAdding((open) => !open)}
              >
                <Plus /> {t("common.add")}
              </Button>
            </div>
            {team?.spawnRequests
              .filter((request) => request.status === "pending")
              .map((request) => {
                const resolving = resolvingRequestIds.has(request.id)
                return (
                  <div
                    aria-busy={resolving}
                    aria-label={t("teams.spawnRequest", { name: request.name })}
                    className="team-spawn-request"
                    key={request.id}
                    role="group"
                  >
                    <div>
                      <strong>{t("teams.addNamedMember", { name: request.name })}</strong>
                      <span>
                        {AGENT_RUNNERS[providerRunner(request.agent)].label} ·{" "}
                        {t("teams.requestedBy", {
                          name:
                            team.members.find((member) => member.slotId === request.requestedBySlotId)?.name ??
                            t("teams.roleLabel.leader"),
                        })}
                      </span>
                    </div>
                    <button
                      aria-label={t("teams.approve", { name: request.name })}
                      disabled={resolving}
                      type="button"
                      onClick={() => void resolveSpawnRequest(request.id, true)}
                    >
                      <Check />
                    </button>
                    <button
                      aria-label={t("teams.reject", { name: request.name })}
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
                  {t("teams.memberName")}
                </label>
                <input
                  autoFocus
                  disabled={addingMember}
                  id={`${inspectorId}-member-name`}
                  placeholder={t("teams.memberName")}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <label className="sr-only" htmlFor={`${inspectorId}-member-runner`}>
                  {t("teams.memberRunner")}
                </label>
                <select
                  aria-label={t("teams.memberRolePreset")}
                  className="team-member-add__role"
                  disabled={addingMember}
                  value={rolePresetId}
                  onChange={(event) => {
                    const nextId = event.target.value
                    setRolePresetId(nextId)
                    const preset = rolePresets.find((item) => item.id === nextId)
                    if (preset) setRunner(providerRunner(preset.agent))
                  }}
                >
                  <option value="">{t("teams.noRole")}</option>
                  {rolePresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {localizeRolePreset(preset, t).name}
                    </option>
                  ))}
                </select>
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
                  {addingMember ? t("teams.adding") : t("common.add")}
                </Button>
              </form>
            )}
            <div className="team-member-list">
              {team?.members.map((member) => {
                const runnerInfo = AGENT_RUNNERS[providerRunner(member.agent)]
                const rolePreset = rolePresets.find((preset) => preset.id === member.rolePresetId)
                const roleName = rolePreset ? localizeRolePreset(rolePreset, t).name : runnerInfo.label
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
                        {t(`teams.roleLabel.${member.role}`)} · {roleName}
                      </span>
                    </div>
                    <span
                      aria-label={t("teams.memberStatus", {
                        name: member.name,
                        status: statusLabel(removing ? "removing" : status, t),
                      })}
                      className="team-member-row__status"
                      data-status={removing ? "removing" : status}
                    >
                      {statusLabel(removing ? "removing" : status, t)}
                    </span>
                    {member.role !== "leader" && (
                      <button
                        aria-label={t("teams.removeMemberNamed", { name: member.name })}
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
                    <p>{task.description || t("teams.noDescription")}</p>
                    <small>
                      {statusLabel(task.status, t)}
                      {task.ownerSlotId
                        ? ` · ${team.members.find((member) => member.slotId === task.ownerSlotId)?.name ?? t("teams.unassigned")}`
                        : ` · ${t("teams.unassigned")}`}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={<ListTodo />} title={t("teams.tasksEmpty")} text={t("teams.tasksEmptyDescription")} />
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
                    <strong>{activityLabel(event.type, t)}</strong>
                    <small>{formatTime(Date.parse(event.createdAt), locale)}</small>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon={<Activity />}
                title={t("teams.activityEmpty")}
                text={t("teams.activityEmptyDescription")}
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

function activityLabel(type: TeamEventType, t: TFunction): string {
  return t(`teams.activityLabels.${ACTIVITY_KEYS[type]}`)
}

function statusLabel(status: string, t: TFunction): string {
  if (
    status === "accepted" ||
    status === "approved" ||
    status === "blocked" ||
    status === "cancelled" ||
    status === "cancelling" ||
    status === "completed" ||
    status === "failed" ||
    status === "idle" ||
    status === "in_progress" ||
    status === "pending" ||
    status === "queued" ||
    status === "ready" ||
    status === "rejected" ||
    status === "removing" ||
    status === "running" ||
    status === "starting" ||
    status === "stopped" ||
    status === "waiting"
  ) {
    return t(`teams.status.${status}`)
  }
  return status
}

function connectionLabel(status: string | undefined, t: TFunction): string {
  if (!status) return t("teams.connection.connecting")
  if (status === "connected" || status === "connecting" || status === "disconnected" || status === "reconnecting")
    return t(`teams.connection.${status}`)
  return status
}

const ACTIVITY_KEYS: Record<TeamEventType, keyof typeof import("@/i18n/resources/en").default.teams.activityLabels> = {
  "team.created": "created",
  "team.updated": "updated",
  "team.deleted": "deleted",
  "team.session.updated": "sessionUpdated",
  "team.member.added": "memberAdded",
  "team.member.updated": "memberUpdated",
  "team.member.removed": "memberRemoved",
  "team.task.created": "taskCreated",
  "team.task.updated": "taskUpdated",
  "team.spawn.requested": "spawnRequested",
  "team.spawn.resolved": "spawnResolved",
  "team.run.accepted": "runAccepted",
  "team.run.started": "runStarted",
  "team.run.updated": "runUpdated",
  "team.run.completed": "runCompleted",
  "team.run.cancelled": "runCancelled",
  "team.run.failed": "runFailed",
  "team.child-turn.queued": "childTurnQueued",
  "team.child-turn.started": "childTurnStarted",
  "team.child-turn.completed": "childTurnCompleted",
  "team.child-turn.cancelled": "childTurnCancelled",
  "team.child-turn.failed": "childTurnFailed",
  "team.message.sent": "messageSent",
}
