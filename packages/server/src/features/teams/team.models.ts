import type {
  AgentProvider,
  MessageAttachment,
  Team,
  TeamEvent,
  TeamEventType,
  TeamMember,
  TeamMemberRole,
  TeamMemberRuntimeStatus,
  TeamMemberWorkStatus,
  TeamRun,
  TeamRunStatus,
  TeamSessionStatus,
  TeamSpawnRequest,
  TeamSpawnRequestStatus,
  TeamTask,
  TeamTaskStatus,
} from "@agent-weave/contracts"

export type TeamLifecycleStatus = "creating" | "active" | "deleting"
export type StoredTeam = Omit<Team, "members" | "tasks" | "spawnRequests" | "activeRun"> & {
  lifecycleStatus: TeamLifecycleStatus
  controlTokenHash: string
}
export type StoredTeamMember = TeamMember & { mcpToken: string; rolePrompt?: string }
export type StoredTeamRun = TeamRun

export type StoredTeamMessage = {
  id: string
  teamId: string
  teamRunId: string
  fromSlotId?: string
  toSlotId: string
  source: "user" | "agent" | "system"
  content: string
  attachments: MessageAttachment[]
  status: "queued" | "delivered" | "cancelled"
  clientMessageId?: string
  createdAt: string
  deliveredAt?: string
}

export type StoredWorkIntent = {
  id: string
  teamId: string
  teamRunId: string
  slotId: string
  messageId: string
  conversationRunId?: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  error?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
}

export type CreateTeamRecord = {
  id: string
  canvasId: string
  name: string
  workspace: string
  leaderSlotId: string
  sessionStatus: TeamSessionStatus
  lifecycleStatus: TeamLifecycleStatus
  controlTokenHash?: string
  now: string
}

export type CreateTeamMemberRecord = {
  slotId: string
  teamId: string
  conversationId: string
  name: string
  role: TeamMemberRole
  agent: AgentProvider
  model?: string
  rolePresetId?: string
  rolePrompt?: string
  mcpToken: string
  runtimeStatus: TeamMemberRuntimeStatus
  workStatus: TeamMemberWorkStatus
  now: string
}

export type CreateTeamRunRecord = {
  id: string
  teamId: string
  targetSlotId: string
  source: TeamRun["source"]
  hasUserIntervention: boolean
  now: string
}

export type CreateTeamMessageRecord = {
  id: string
  teamId: string
  teamRunId: string
  fromSlotId?: string
  toSlotId: string
  source: StoredTeamMessage["source"]
  content: string
  attachments: MessageAttachment[]
  clientMessageId?: string
  now: string
}

export type CreateWorkIntentRecord = {
  id: string
  teamId: string
  teamRunId: string
  slotId: string
  messageId: string
  now: string
}

export type CreateTeamTaskRecord = {
  id: string
  teamId: string
  subject: string
  description: string
  status: TeamTaskStatus
  ownerSlotId?: string
  createdBySlotId?: string
  blockedBy: string[]
  now: string
}

export type CreateTeamSpawnRequestRecord = {
  id: string
  teamId: string
  requestedBySlotId: string
  name: string
  agent: AgentProvider
  model?: string
  now: string
}

export type AppendTeamEventInput = {
  id: string
  teamId: string
  teamRunId?: string
  slotId?: string
  type: TeamEventType
  data: unknown
  createdAt: string
}

export interface TeamRepository {
  transaction<T>(action: () => T): T
  createTeam(input: CreateTeamRecord): StoredTeam
  getTeam(id: string): StoredTeam | undefined
  getSnapshot(id: string): Team | undefined
  listSnapshots(canvasId?: string, includeInactive?: boolean): Team[]
  updateTeam(
    id: string,
    patch: {
      name?: string
      sessionStatus?: TeamSessionStatus
      lifecycleStatus?: TeamLifecycleStatus
      error?: string | null
      updatedAt: string
    },
  ): StoredTeam
  deleteTeam(id: string): void
  createMember(input: CreateTeamMemberRecord): StoredTeamMember
  getMember(teamId: string, slotId: string): StoredTeamMember | undefined
  getMemberByToken(token: string): StoredTeamMember | undefined
  findMember(teamId: string, identifier: string): StoredTeamMember | undefined
  listMembers(teamId: string): StoredTeamMember[]
  updateMember(
    slotId: string,
    patch: {
      name?: string
      runtimeStatus?: TeamMemberRuntimeStatus
      workStatus?: TeamMemberWorkStatus
      error?: string | null
      updatedAt: string
    },
  ): StoredTeamMember
  deleteMember(slotId: string, now: string): void
  createRun(input: CreateTeamRunRecord): StoredTeamRun
  getRun(teamId: string, runId: string): StoredTeamRun | undefined
  findActiveRun(teamId: string): StoredTeamRun | undefined
  listRuns(teamId: string): StoredTeamRun[]
  updateRun(
    runId: string,
    patch: {
      status?: TeamRunStatus
      hasUserIntervention?: boolean
      error?: string | null
      startedAt?: string | null
      completedAt?: string | null
    },
  ): StoredTeamRun
  createMessage(input: CreateTeamMessageRecord): StoredTeamMessage
  getMessage(id: string): StoredTeamMessage | undefined
  findMessageByClientId(teamId: string, clientMessageId: string): StoredTeamMessage | undefined
  updateMessageStatus(id: string, status: StoredTeamMessage["status"], now: string): void
  createIntent(input: CreateWorkIntentRecord): StoredWorkIntent
  getIntent(id: string): StoredWorkIntent | undefined
  nextQueuedIntent(teamId: string, slotId: string): StoredWorkIntent | undefined
  claimNextQueuedIntent(teamId: string, slotId: string, startedAt: string): StoredWorkIntent | undefined
  findRunningIntent(teamId: string, slotId: string): StoredWorkIntent | undefined
  listActiveMemberIntents(teamId: string, slotId: string): StoredWorkIntent[]
  listInterruptedIntents(): StoredWorkIntent[]
  listRunIntents(runId: string): StoredWorkIntent[]
  updateIntent(
    id: string,
    patch: {
      status?: StoredWorkIntent["status"]
      conversationRunId?: string | null
      error?: string | null
      startedAt?: string | null
      completedAt?: string | null
    },
  ): StoredWorkIntent
  transitionIntent(
    id: string,
    expectedStatus: StoredWorkIntent["status"],
    patch: {
      status?: StoredWorkIntent["status"]
      conversationRunId?: string | null
      error?: string | null
      startedAt?: string | null
      completedAt?: string | null
    },
  ): StoredWorkIntent | undefined
  createTask(input: CreateTeamTaskRecord): TeamTask
  getTask(teamId: string, taskId: string): TeamTask | undefined
  listTasks(teamId: string): TeamTask[]
  updateTask(
    taskId: string,
    patch: {
      subject?: string
      description?: string
      status?: TeamTaskStatus
      ownerSlotId?: string | null
      blockedBy?: string[]
      updatedAt: string
    },
  ): TeamTask
  createSpawnRequest(input: CreateTeamSpawnRequestRecord): TeamSpawnRequest
  getSpawnRequest(teamId: string, requestId: string): TeamSpawnRequest | undefined
  listSpawnRequests(teamId: string): TeamSpawnRequest[]
  updateSpawnRequest(
    requestId: string,
    patch: { status: TeamSpawnRequestStatus; memberSlotId?: string; resolvedAt: string },
  ): TeamSpawnRequest
  appendEvent(input: AppendTeamEventInput): TeamEvent
  listEventsAfter(teamId: string, sequence: number): TeamEvent[]
  resetInterruptedWork(): void
  listQueuedSlots(): Array<{ teamId: string; slotId: string }>
}
