import type {
  AddTeamMemberRequest,
  CreatedTeam,
  CreateTeamRequest,
  SendTeamMessageRequest,
  Team,
  TeamMember,
  TeamMessageReceipt,
  TeamRun,
  TeamSpawnRequest,
  UpdateTeamRequest,
} from "@agent-weave/contracts"
import { apiClient } from "@/lib/api"
import { teamControlTokenStore } from "./team-control-token-store"

const teamsPath = "/teams"
const controlTokenHeader = "x-agent-weave-team-control"

function teamPath(teamId: string): string {
  return `${teamsPath}/${encodeURIComponent(teamId)}`
}

function controlConfig(teamId: string): { headers: Record<string, string> } | undefined {
  const token = teamControlTokenStore.get(teamId)
  return token ? { headers: { [controlTokenHeader]: token } } : undefined
}

export const teamApi = {
  async create(input: CreateTeamRequest): Promise<Team> {
    const created = await apiClient.post<CreatedTeam, CreateTeamRequest>(teamsPath, input)
    teamControlTokenStore.set(created.id, created.controlToken)
    const { controlToken: _controlToken, ...team } = created
    return team
  },

  list(canvasId: string): Promise<Team[]> {
    return apiClient.get(teamsPath, { params: { canvasId } })
  },

  get(teamId: string): Promise<Team> {
    return apiClient.get(teamPath(teamId))
  },

  update(teamId: string, input: UpdateTeamRequest): Promise<Team> {
    return apiClient.patch<Team, UpdateTeamRequest>(teamPath(teamId), input, controlConfig(teamId))
  },

  async delete(teamId: string): Promise<{ teamId: string; deleted: boolean }> {
    const result = await apiClient.delete<{ teamId: string; deleted: boolean }>(teamPath(teamId), controlConfig(teamId))
    teamControlTokenStore.remove(teamId)
    return result
  },

  addMember(teamId: string, input: AddTeamMemberRequest): Promise<TeamMember> {
    return apiClient.post<TeamMember, AddTeamMemberRequest>(`${teamPath(teamId)}/members`, input, controlConfig(teamId))
  },

  removeMember(teamId: string, slotId: string): Promise<{ teamId: string; slotId: string; removed: boolean }> {
    return apiClient.delete(`${teamPath(teamId)}/members/${encodeURIComponent(slotId)}`, controlConfig(teamId))
  },

  sendMessage(teamId: string, input: SendTeamMessageRequest): Promise<TeamMessageReceipt> {
    return apiClient.post<TeamMessageReceipt, SendTeamMessageRequest>(
      `${teamPath(teamId)}/messages`,
      input,
      controlConfig(teamId),
    )
  },

  sendMemberMessage(teamId: string, slotId: string, input: SendTeamMessageRequest): Promise<TeamMessageReceipt> {
    return apiClient.post<TeamMessageReceipt, SendTeamMessageRequest>(
      `${teamPath(teamId)}/members/${encodeURIComponent(slotId)}/messages`,
      input,
      controlConfig(teamId),
    )
  },

  listRuns(teamId: string): Promise<TeamRun[]> {
    return apiClient.get(`${teamPath(teamId)}/runs`)
  },

  cancelRun(teamId: string, runId: string): Promise<TeamRun> {
    return apiClient.post(
      `${teamPath(teamId)}/runs/${encodeURIComponent(runId)}/cancel`,
      undefined,
      controlConfig(teamId),
    )
  },

  approveSpawnRequest(teamId: string, requestId: string): Promise<TeamMember> {
    return apiClient.post(
      `${teamPath(teamId)}/spawn-requests/${encodeURIComponent(requestId)}/approve`,
      undefined,
      controlConfig(teamId),
    )
  },

  rejectSpawnRequest(teamId: string, requestId: string): Promise<TeamSpawnRequest> {
    return apiClient.post(
      `${teamPath(teamId)}/spawn-requests/${encodeURIComponent(requestId)}/reject`,
      undefined,
      controlConfig(teamId),
    )
  },
}
