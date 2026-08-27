import type { Team, TeamEvent } from "@agent-weave/contracts"
import { openTeamEventStream, teamApi } from "@/features/teams/api"
import { teamStore } from "@/features/teams/store"
import { ApiClientError } from "@/lib/api"

type ActiveConnection = { cancelled: boolean; source?: EventSource }
type TeamEventListener = (event: TeamEvent) => void

class TeamController {
  private readonly connections = new Map<string, ActiveConnection>()
  private readonly canvasLoadVersions = new Map<string, number>()
  private readonly listeners = new Set<TeamEventListener>()

  async loadCanvas(canvasId: string): Promise<Team[] | undefined> {
    const version = (this.canvasLoadVersions.get(canvasId) ?? 0) + 1
    this.canvasLoadVersions.set(canvasId, version)
    const replayRevisions = new Map<string, number>()
    for (const [teamId, view] of Object.entries(teamStore.getState().teams)) {
      if (view.team?.canvasId === canvasId) replayRevisions.set(teamId, view.dataRevision)
    }
    const teams = await teamApi.list(canvasId)
    if (this.canvasLoadVersions.get(canvasId) !== version) return undefined
    const activeTeamIds = new Set(teams.map((team) => team.id))
    for (const [teamId, view] of Object.entries(teamStore.getState().teams)) {
      if (view.team?.canvasId === canvasId && !activeTeamIds.has(teamId)) {
        this.disconnect(teamId)
        teamStore.getState().remove(teamId)
      }
    }
    const hydratedTeams = teams.map((team) => {
      const replayRevision = replayRevisions.get(team.id)
      const currentView = teamStore.getState().teams[team.id]
      if (replayRevision === undefined || currentView?.dataRevision === replayRevision) {
        teamStore.getState().prepareReplay(team)
      }
      this.connect(team.id)
      return teamStore.getState().teams[team.id]?.team ?? team
    })
    return hydratedTeams
  }

  prepare(team: Team): void {
    const currentView = teamStore.getState().teams[team.id]
    if (!this.connections.has(team.id) || !currentView?.team) teamStore.getState().prepareReplay(team)
    this.connect(team.id)
  }

  async refresh(teamId: string): Promise<Team | undefined> {
    const initialView = teamStore.getState().teams[teamId]
    const initialRevision = initialView?.dataRevision
    const team = await teamApi.get(teamId)
    const currentView = teamStore.getState().teams[teamId]
    if (initialView && !currentView) return undefined
    if (!currentView || currentView.dataRevision === initialRevision) {
      teamStore.getState().prepareReplay(team)
    }
    this.connect(team.id)
    return teamStore.getState().teams[team.id]?.team
  }

  connect(teamId: string): void {
    if (!teamId || this.connections.has(teamId)) return
    const connection: ActiveConnection = { cancelled: false }
    this.connections.set(teamId, connection)
    teamStore.getState().setConnectionStatus(teamId, "connecting")
    void this.initializeConnection(teamId, connection)
  }

  async destroy(teamId: string): Promise<void> {
    this.disconnect(teamId)
    try {
      await teamApi.delete(teamId)
      teamStore.getState().remove(teamId)
    } catch (error) {
      teamStore.getState().setError(teamId, errorMessage(error))
      if (teamStore.getState().teams[teamId]?.team) this.connect(teamId)
      throw error
    }
  }

  disconnect(teamId: string): void {
    const connection = this.connections.get(teamId)
    if (!connection) return
    connection.cancelled = true
    connection.source?.close()
    this.connections.delete(teamId)
    teamStore.getState().setConnectionStatus(teamId, "idle")
  }

  disconnectAll(): void {
    for (const teamId of this.connections.keys()) this.disconnect(teamId)
  }

  disconnectCanvas(canvasId: string): void {
    this.canvasLoadVersions.set(canvasId, (this.canvasLoadVersions.get(canvasId) ?? 0) + 1)
    for (const teamId of this.connections.keys()) {
      if (teamStore.getState().teams[teamId]?.team?.canvasId === canvasId) this.disconnect(teamId)
    }
  }

  subscribe(listener: TeamEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private async initializeConnection(teamId: string, connection: ActiveConnection): Promise<void> {
    const isCurrent = () => !connection.cancelled && this.connections.get(teamId) === connection
    const initialRevision = teamStore.getState().teams[teamId]?.dataRevision
    try {
      const team = await teamApi.get(teamId)
      if (!isCurrent()) return
      const currentView = teamStore.getState().teams[teamId]
      if (!currentView || currentView.dataRevision === initialRevision) teamStore.getState().prepareReplay(team)
      const after = teamStore.getState().teams[teamId]?.lastSequence ?? 0
      connection.source = openTeamEventStream({
        teamId,
        after,
        onEvent: (event) => {
          if (!isCurrent()) return
          if (event.teamId !== teamId) {
            teamStore.getState().setError(teamId, "The server sent an event for the wrong team.")
            return
          }
          teamStore.getState().applyEvent(event)
          for (const listener of this.listeners) listener(event)
          if (event.type === "team.deleted") {
            this.disconnect(teamId)
            teamStore.getState().remove(teamId)
          }
        },
        onConnectionChange: (connected) => {
          if (!isCurrent()) return
          teamStore.getState().setConnectionStatus(teamId, connected ? "connected" : "reconnecting")
        },
        onProtocolError: (message) => {
          if (isCurrent()) teamStore.getState().setError(teamId, message)
        },
      })
    } catch (error) {
      if (!isCurrent()) return
      connection.cancelled = true
      this.connections.delete(teamId)
      teamStore.getState().setError(teamId, errorMessage(error))
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message
  return error instanceof Error ? error.message : "The team request failed."
}

export const teamController = new TeamController()
