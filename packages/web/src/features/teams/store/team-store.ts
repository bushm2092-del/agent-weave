import type { Team, TeamEvent, TeamMember, TeamRun, TeamSpawnRequest, TeamTask } from "@agent-weave/contracts"
import { create } from "zustand"
import { immer } from "zustand/middleware/immer"

export type TeamConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting"

export type TeamView = {
  team?: Team
  events: TeamEvent[]
  dataRevision: number
  lastSequence: number
  connectionStatus: TeamConnectionStatus
  loading: boolean
  error?: string
}

type TeamStore = {
  teams: Record<string, TeamView>
  prepareReplay: (team: Team) => void
  applyEvent: (event: TeamEvent) => void
  setConnectionStatus: (teamId: string, status: TeamConnectionStatus) => void
  setError: (teamId: string, error?: string) => void
  remove: (teamId: string) => void
}

function emptyView(): TeamView {
  return { events: [], dataRevision: 0, lastSequence: 0, connectionStatus: "idle", loading: true }
}

export const useTeamStore = create<TeamStore>()(
  immer((set) => ({
    teams: {},
    prepareReplay: (team) => {
      set((state) => {
        const view = (state.teams[team.id] ??= emptyView())
        view.team = team
        view.dataRevision += 1
        view.loading = false
        view.error = undefined
      })
    },
    applyEvent: (event) => {
      set((state) => {
        const view = (state.teams[event.teamId] ??= emptyView())
        if (event.sequence <= view.lastSequence) return
        view.dataRevision += 1
        view.lastSequence = event.sequence
        view.events.push(event)
        if (view.events.length > 200) view.events.splice(0, view.events.length - 200)
        applyEvent(view, event)
      })
    },
    setConnectionStatus: (teamId, status) => {
      set((state) => {
        const view = (state.teams[teamId] ??= emptyView())
        view.connectionStatus = status
      })
    },
    setError: (teamId, error) => {
      set((state) => {
        const view = (state.teams[teamId] ??= emptyView())
        view.error = error
        view.loading = false
      })
    },
    remove: (teamId) => {
      set((state) => {
        delete state.teams[teamId]
      })
    },
  })),
)

function applyEvent(view: TeamView, event: TeamEvent): void {
  if (event.type === "team.deleted") {
    view.team = undefined
    return
  }
  if (event.type === "team.created") {
    view.team = event.data as Team
    return
  }
  const team = view.team
  if (!team) return

  if (event.type === "team.updated" || event.type === "team.session.updated") {
    const update = event.data as Partial<Team>
    Object.assign(team, update)
  } else if (event.type === "team.member.added") {
    upsertMember(team, event.data as TeamMember)
  } else if (event.type === "team.member.updated") {
    upsertMember(team, event.data as TeamMember)
  } else if (event.type === "team.member.removed") {
    team.members = team.members.filter((member) => member.slotId !== event.slotId)
  } else if (event.type === "team.task.created" || event.type === "team.task.updated") {
    upsertTask(team, event.data as TeamTask)
  } else if (event.type === "team.spawn.requested" || event.type === "team.spawn.resolved") {
    upsertSpawnRequest(team, event.data as TeamSpawnRequest)
  } else if (event.type.startsWith("team.run.")) {
    const run = event.data as TeamRun
    team.activeRun = isTerminalRun(run) ? undefined : run
  }
}

function upsertMember(team: Team, member: TeamMember): void {
  const index = team.members.findIndex((candidate) => candidate.slotId === member.slotId)
  if (index === -1) team.members.push(member)
  else team.members[index] = member
}

function upsertTask(team: Team, task: TeamTask): void {
  const index = team.tasks.findIndex((candidate) => candidate.id === task.id)
  if (index === -1) team.tasks.push(task)
  else team.tasks[index] = task
}

function upsertSpawnRequest(team: Team, request: TeamSpawnRequest): void {
  const index = team.spawnRequests.findIndex((candidate) => candidate.id === request.id)
  if (index === -1) team.spawnRequests.push(request)
  else team.spawnRequests[index] = request
}

function isTerminalRun(run: TeamRun): boolean {
  return run.status === "completed" || run.status === "cancelled" || run.status === "failed"
}

export const teamStore = useTeamStore
