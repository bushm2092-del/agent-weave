import type { RolePreset } from "@agent-weave/contracts"
import { FolderOpen, Plus, Trash2, Users, X } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { AGENT_RUNNERS, AGENT_RUNNER_IDS, type AgentRunner } from "@/features/canvas/agent-options"
import { AgentRunnerIcon } from "@/features/canvas/agent-runner-icon"
import { rolePresetApi } from "@/features/role-presets"
import { localizeErrorPresentation, localizeRolePreset, toErrorPresentation, type PresentableError } from "@/i18n"

export type TeamDraft = {
  name: string
  workspace: string
  leader: { name: string; runner: AgentRunner; rolePresetId?: string }
  members: Array<{ name: string; runner: AgentRunner; rolePresetId?: string }>
}

export function CreateTeamDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (draft: TeamDraft) => Promise<void>
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(() => t("teams.defaults.teamName"))
  const [workspace, setWorkspace] = useState("")
  const [leaderName, setLeaderName] = useState(() => t("teams.defaults.leaderName"))
  const [leaderRunner, setLeaderRunner] = useState<AgentRunner>("codex")
  const [leaderRolePresetId, setLeaderRolePresetId] = useState("")
  const [members, setMembers] = useState<TeamDraft["members"]>([])
  const [rolePresets, setRolePresets] = useState<RolePreset[]>([])
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<PresentableError>()
  const titleId = useId()

  useEffect(() => {
    void rolePresetApi
      .list()
      .then(setRolePresets)
      .catch((loadError: unknown) => setError(toErrorPresentation(loadError, "errors.fallbacks.loadRolePresets")))
  }, [])

  const selectLeaderPreset = (presetId: string) => {
    setLeaderRolePresetId(presetId)
    const preset = rolePresets.find((item) => item.id === presetId)
    if (preset) setLeaderRunner(runnerForProvider(preset.agent))
  }

  const create = async () => {
    if (creating) return
    setCreating(true)
    setError(undefined)
    try {
      await onCreate({
        name: name.trim(),
        workspace: workspace.trim(),
        leader: {
          name: leaderName.trim(),
          runner: leaderRunner,
          ...(leaderRolePresetId ? { rolePresetId: leaderRolePresetId } : {}),
        },
        members: members.map((member) => ({ ...member, name: member.name.trim() })),
      })
    } catch (createError) {
      setError(toErrorPresentation(createError, "errors.fallbacks.createTeam"))
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
            <h2 id={titleId}>{t("canvas.tools.newTeam")}</h2>
            <p>{t("teams.createDescription")}</p>
          </div>
        </div>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t("common.close")}
          disabled={creating}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>

      <div className="team-composer__row">
        <label>
          {t("teams.teamName")}
          <input disabled={creating} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          {t("teams.leaderName")}
          <input disabled={creating} value={leaderName} onChange={(event) => setLeaderName(event.target.value)} />
        </label>
      </div>

      <div className="agent-composer__field">
        <label htmlFor="leader-role-preset">{t("teams.leaderRole")}</label>
        <select
          id="leader-role-preset"
          className="team-role-preset-select"
          disabled={creating}
          value={leaderRolePresetId}
          onChange={(event) => selectLeaderPreset(event.target.value)}
        >
          <option value="">{t("teams.noRolePreset")}</option>
          {rolePresets.map((preset) => {
            const display = localizeRolePreset(preset, t)
            return (
              <option key={preset.id} value={preset.id}>
                {display.category} · {display.name}
              </option>
            )
          })}
        </select>
      </div>

      <div className="agent-composer__field">
        <label>{t("teams.leaderRunner")}</label>
        <RunnerPicker disabled={creating} value={leaderRunner} onChange={setLeaderRunner} />
      </div>

      <div className="agent-composer__field">
        <label htmlFor="team-workspace">{t("teams.sharedWorkspace")}</label>
        <div className="agent-workspace-input">
          <FolderOpen />
          <input
            id="team-workspace"
            disabled={creating}
            value={workspace}
            onChange={(event) => setWorkspace(event.target.value)}
            placeholder={t("agents.workspacePlaceholder")}
          />
        </div>
      </div>

      <div className="team-composer__members">
        <div>
          <label>{t("teams.initialTeammates")}</label>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={creating}
            onClick={() =>
              setMembers((current) => [
                ...current,
                { name: t("teams.defaults.teammateName", { count: current.length + 1 }), runner: "codex" },
              ])
            }
          >
            <Plus /> {t("common.add")}
          </Button>
        </div>
        {members.map((member, index) => (
          <div className="team-composer__member" key={index}>
            <input
              disabled={creating}
              value={member.name}
              aria-label={t("teams.teammateName", { count: index + 1 })}
              onChange={(event) =>
                setMembers((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
            />
            <select
              className="team-composer__role-select"
              disabled={creating}
              value={member.rolePresetId ?? ""}
              aria-label={t("teams.role", { count: index + 1 })}
              onChange={(event) => {
                const rolePresetId = event.target.value
                const preset = rolePresets.find((item) => item.id === rolePresetId)
                setMembers((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? {
                          ...item,
                          ...(rolePresetId ? { rolePresetId } : { rolePresetId: undefined }),
                          ...(preset ? { runner: runnerForProvider(preset.agent) } : {}),
                        }
                      : item,
                  ),
                )
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
              disabled={creating}
              value={member.runner}
              aria-label={t("teams.runner", { count: index + 1 })}
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
              aria-label={t("teams.removeMember")}
              disabled={creating}
              onClick={() => setMembers((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {members.length === 0 && <p>{t("teams.noTeammates")}</p>}
      </div>

      {error && (
        <p className="agent-composer__error" role="alert">
          {localizeErrorPresentation(error, t)}
        </p>
      )}
      <div className="agent-composer__actions">
        <Button type="button" disabled={creating} variant="ghost" onClick={onClose}>
          {t("common.cancel")}
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
          {creating ? t("teams.creating") : t("teams.create")}
        </Button>
      </div>
    </section>
  )
}

function runnerForProvider(provider: RolePreset["agent"]): AgentRunner {
  return AGENT_RUNNER_IDS.find((id) => AGENT_RUNNERS[id].provider === provider) ?? "codex"
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
  const { t } = useTranslation()
  return (
    <div aria-label={t("teams.leaderRunner")} className="agent-runner-grid" role="group">
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
