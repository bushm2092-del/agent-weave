import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type {
  AddTeamMemberRequest,
  Conversation,
  CreatedTeam,
  CreateTeamRequest,
  MessageAttachment,
  Run,
  SendTeamMessageRequest,
  Team,
  TeamEvent,
  TeamMember,
  TeamMessageReceipt,
  TeamRun,
  TeamSpawnRequest,
  UpdateTeamRequest,
} from "@agent-weave/contracts"
import { agentProviderSchema, teamTaskStatusSchema } from "@agent-weave/contracts"
import { z } from "zod"
import { environment } from "../../config/index.js"
import { conversationService, type ManagedConversationInput } from "../conversations/index.js"
import { TeamError } from "./team.errors.js"
import { teamEventBus, type TeamEventBus } from "./team-event-bus.js"
import type { StoredTeamMember, StoredTeamMessage, StoredWorkIntent, TeamRepository } from "./team.models.js"
import { teamRepository } from "./persistence/index.js"
import {
  MemoryTeamToolCallRepository,
  teamToolCallRepository,
  type TeamToolCallRepository,
} from "./persistence/team-tool-call.repository.js"
import { teamRolePrompt, teamWakePrompt } from "./prompts/team-prompts.js"

export interface TeamConversationPort {
  createManaged(input: ManagedConversationInput): Promise<Conversation>
  configureManagedSession(
    conversationId: string,
    ownerId: string,
    sessionContext: ManagedConversationInput["sessionContext"],
  ): void
  listManagedConversations(): Array<{ id: string; ownerId: string }>
  deleteManaged(conversationId: string, ownerId: string): Promise<void>
  createManagedRun(
    conversationId: string,
    ownerId: string,
    input: { message: string; attachments: MessageAttachment[] },
  ): Promise<Run>
  cancelRun(conversationId: string, runId: string): Promise<Run>
  getRun(conversationId: string, runId: string): Run
  waitForRun(conversationId: string, runId: string): Promise<Run>
  waitUntilReady(conversationId: string): Promise<Conversation>
}

export class TeamService {
  private readonly processingSlots = new Set<string>()
  private readonly mutationTails = new Map<string, Promise<void>>()

  constructor(
    private readonly repository: TeamRepository,
    private readonly conversations: TeamConversationPort,
    private readonly eventBus: TeamEventBus,
    private readonly toolCalls: TeamToolCallRepository = new MemoryTeamToolCallRepository(),
  ) {}

  async create(input: CreateTeamRequest): Promise<CreatedTeam> {
    if (input.members.length > 7) throw new TeamError("TEAM_MEMBER_LIMIT", "A team can have at most 8 members.", 409)
    const names = [input.leader.name, ...input.members.map((member) => member.name)]
    assertUniqueMemberNames(names)
    const workspace = resolve(input.workspace)
    const teamId = randomUUID()
    const leaderSlotId = randomUUID()
    const controlToken = randomBytes(32).toString("base64url")
    const now = new Date().toISOString()
    this.repository.createTeam({
      id: teamId,
      canvasId: input.canvasId,
      name: input.name,
      workspace,
      leaderSlotId,
      sessionStatus: "starting",
      lifecycleStatus: "creating",
      controlTokenHash: hashControlToken(controlToken).toString("hex"),
      now,
    })

    const createdMembers: Array<{ slotId: string; conversationId: string }> = []
    try {
      const members = [
        { ...input.leader, slotId: leaderSlotId, role: "leader" as const },
        ...input.members.map((member) => ({ ...member, slotId: randomUUID(), role: "teammate" as const })),
      ]
      for (const member of members) {
        const created = await this.provisionMember({
          teamId,
          teamName: input.name,
          workspace,
          slotId: member.slotId,
          role: member.role,
          name: member.name,
          agent: member.agent,
          ...(member.model ? { model: member.model } : {}),
        })
        createdMembers.push({ slotId: created.slotId, conversationId: created.conversationId })
      }
      this.repository.updateTeam(teamId, { lifecycleStatus: "active", updatedAt: new Date().toISOString() })
      const team = this.requireSnapshot(teamId)
      this.eventBus.publish({ teamId, type: "team.created", data: team })
      return { ...team, controlToken }
    } catch (error) {
      this.repository.deleteTeam(teamId)
      await Promise.allSettled(
        createdMembers.map((member) => this.conversations.deleteManaged(member.conversationId, member.slotId)),
      )
      throw error
    }
  }

  get(teamId: string): Team {
    return this.requireSnapshot(teamId)
  }

  list(canvasId?: string): Team[] {
    return this.repository.listSnapshots(canvasId)
  }

  listRuns(teamId: string): TeamRun[] {
    this.requireTeam(teamId)
    return this.repository.listRuns(teamId)
  }

  authorizeControl(teamId: string, controlToken: string | undefined): void {
    const expectedHash = this.requireTeam(teamId).controlTokenHash
    if (!expectedHash) return
    const actualHash = controlToken ? hashControlToken(controlToken) : undefined
    const expected = Buffer.from(expectedHash, "hex")
    if (!actualHash || actualHash.length !== expected.length || !timingSafeEqual(actualHash, expected)) {
      throw new TeamError("TEAM_CONTROL_UNAUTHORIZED", "Team control authorization is required.", 401)
    }
  }

  update(teamId: string, input: UpdateTeamRequest): Team {
    this.requireTeam(teamId)
    const updated = this.repository.updateTeam(teamId, { name: input.name, updatedAt: new Date().toISOString() })
    const snapshot = this.requireSnapshot(teamId)
    this.eventBus.publish({ teamId, type: "team.updated", data: updated })
    return snapshot
  }

  async delete(teamId: string): Promise<void> {
    return this.withTeamMutation(teamId, () => this.deleteUnlocked(teamId))
  }

  private async deleteUnlocked(teamId: string): Promise<void> {
    const team = this.requireSnapshot(teamId)
    const removingAt = new Date().toISOString()
    this.repository.updateTeam(teamId, { lifecycleStatus: "deleting", updatedAt: removingAt })
    for (const member of team.members) {
      this.repository.updateMember(member.slotId, { runtimeStatus: "removing", updatedAt: removingAt })
    }
    const activeRun = this.repository.findActiveRun(teamId)
    if (activeRun) await this.cancelRun(teamId, activeRun.id)
    this.eventBus.publish({ teamId, type: "team.deleted", data: { teamId } })
    this.repository.deleteTeam(teamId)
    await Promise.allSettled(
      team.members.map((member) => this.conversations.deleteManaged(member.conversationId, member.slotId)),
    )
  }

  async addMember(teamId: string, input: AddTeamMemberRequest): Promise<TeamMember> {
    return this.withTeamMutation(teamId, () => this.addMemberUnlocked(teamId, input))
  }

  private async addMemberUnlocked(teamId: string, input: AddTeamMemberRequest): Promise<TeamMember> {
    const team = this.requireSnapshot(teamId)
    if (team.members.length >= 8) throw new TeamError("TEAM_MEMBER_LIMIT", "A team can have at most 8 members.", 409)
    if (team.members.some((member) => normalizeName(member.name) === normalizeName(input.name))) {
      throw new TeamError("TEAM_MEMBER_NAME_CONFLICT", "Team member names must be unique.", 409)
    }
    return this.provisionMember({
      teamId,
      teamName: team.name,
      workspace: team.workspace,
      slotId: randomUUID(),
      role: "teammate",
      name: input.name,
      agent: input.agent,
      ...(input.model ? { model: input.model } : {}),
    })
  }

  async removeMember(teamId: string, slotId: string): Promise<void> {
    return this.withTeamMutation(teamId, () => this.removeMemberUnlocked(teamId, slotId))
  }

  private async removeMemberUnlocked(teamId: string, slotId: string): Promise<void> {
    const member = this.requireMember(teamId, slotId)
    if (member.role === "leader") {
      throw new TeamError("TEAM_LEADER_REQUIRED", "The team leader can only be removed with the entire team.", 409)
    }
    const now = new Date().toISOString()
    this.repository.updateMember(slotId, { runtimeStatus: "removing", updatedAt: now })
    const activeIntents = this.repository.listActiveMemberIntents(teamId, slotId)
    const affectedRunIds = new Set<string>()
    const conversationRunIds: string[] = []
    for (const intent of activeIntents) {
      const cancelled = this.repository.transitionIntent(intent.id, intent.status, {
        status: "cancelled",
        completedAt: now,
      })
      if (!cancelled) continue
      affectedRunIds.add(intent.teamRunId)
      this.repository.updateMessageStatus(intent.messageId, "cancelled", now)
      if (cancelled.conversationRunId) conversationRunIds.push(cancelled.conversationRunId)
    }
    await Promise.allSettled(
      conversationRunIds.map((runId) => this.conversations.cancelRun(member.conversationId, runId)),
    )
    this.repository.deleteMember(slotId, now)
    for (const runId of affectedRunIds) this.settleRun(runId)
    this.eventBus.publish({
      teamId,
      slotId,
      type: "team.member.removed",
      data: { teamId, slotId, conversationId: member.conversationId },
    })
    await this.conversations.deleteManaged(member.conversationId, slotId)
  }

  sendTeamMessage(teamId: string, input: SendTeamMessageRequest): TeamMessageReceipt {
    const team = this.requireSnapshot(teamId)
    return this.queueUserMessage(team, team.leaderSlotId, input, "team_message", false)
  }

  sendMemberMessage(teamId: string, slotId: string, input: SendTeamMessageRequest): TeamMessageReceipt {
    const team = this.requireSnapshot(teamId)
    this.requireAvailableMember(teamId, slotId)
    return this.queueUserMessage(team, slotId, input, "member_message", true)
  }

  async cancelRun(teamId: string, runId: string): Promise<TeamRun> {
    const run = this.requireRun(teamId, runId)
    if (isTerminalTeamRun(run)) return run
    const now = new Date().toISOString()
    const cancelling = this.repository.updateRun(run.id, { status: "cancelling" })
    this.eventBus.publish({
      teamId,
      teamRunId: run.id,
      type: "team.run.updated",
      data: cancelling,
    })
    const conversationRuns: Array<{ conversationId: string; runId: string }> = []
    for (const intent of this.repository.listRunIntents(run.id)) {
      if (intent.status === "queued" || intent.status === "running") {
        const member = this.repository.getMember(teamId, intent.slotId)
        const cancelled = this.repository.transitionIntent(intent.id, intent.status, {
          status: "cancelled",
          completedAt: now,
        })
        if (!cancelled) continue
        this.repository.updateMessageStatus(intent.messageId, "cancelled", now)
        if (member && cancelled.conversationRunId) {
          conversationRuns.push({ conversationId: member.conversationId, runId: cancelled.conversationRunId })
        }
      }
    }
    await Promise.allSettled(
      conversationRuns.map(({ conversationId, runId: conversationRunId }) =>
        this.conversations.cancelRun(conversationId, conversationRunId),
      ),
    )
    this.settleRun(run.id)
    return this.requireRun(teamId, runId)
  }

  eventsAfter(teamId: string, sequence: number): TeamEvent[] {
    this.requireTeam(teamId)
    return this.repository.listEventsAfter(teamId, sequence)
  }

  subscribe(teamId: string, listener: (event: TeamEvent) => void): () => void {
    this.requireTeam(teamId)
    return this.eventBus.subscribe(teamId, listener)
  }

  async executeTool(
    token: string,
    toolName: string,
    rawArguments: unknown,
    requestId?: string | number,
  ): Promise<unknown> {
    const caller = this.repository.getMemberByToken(token)
    if (!caller) throw new TeamError("TEAM_TOOL_UNAUTHORIZED", "Team tool authentication failed.", 401)
    if (requestId !== undefined && mutatingTeamTools.has(toolName)) {
      return this.eventBus.transaction(() =>
        this.toolCalls.run(
          {
            callerSlotId: caller.slotId,
            requestId: canonicalToolRequestId(requestId),
            toolName,
          },
          () => this.executeToolAsCaller(caller, toolName, rawArguments),
        ),
      )
    }
    return this.executeToolAsCaller(caller, toolName, rawArguments)
  }

  private executeToolAsCaller(caller: StoredTeamMember, toolName: string, rawArguments: unknown): unknown {
    if (caller.runtimeStatus === "removing") {
      throw new TeamError("TEAM_MEMBER_REMOVING", "This team member is being removed.", 409)
    }

    switch (toolName) {
      case "team_members":
        emptyToolSchema.parse(rawArguments)
        return this.repository.listMembers(caller.teamId).map(publicMember)
      case "team_send_message": {
        const input = sendMessageToolSchema.parse(rawArguments)
        const target = this.repository.findMember(caller.teamId, input.target)
        if (!target) throw new TeamError("TEAM_MEMBER_NOT_FOUND", "Message recipient was not found.", 404)
        if (target.runtimeStatus === "removing") {
          throw new TeamError("TEAM_MEMBER_REMOVING", "The message recipient is being removed.", 409)
        }
        const runningIntent = this.repository.findRunningIntent(caller.teamId, caller.slotId)
        const run = runningIntent
          ? this.requireRun(caller.teamId, runningIntent.teamRunId)
          : this.repository.findActiveRun(caller.teamId)
        if (!run || run.status === "cancelling") {
          throw new TeamError("TEAM_RUN_NOT_ACTIVE", "Agent messages require an active team run.", 409)
        }
        const message = this.queueMessage({
          teamId: caller.teamId,
          teamRunId: run.id,
          fromSlotId: caller.slotId,
          toSlotId: target.slotId,
          source: "agent",
          content: input.message,
          attachments: [],
        })
        return { messageId: message.id, teamRunId: run.id, targetSlotId: target.slotId, status: "queued" }
      }
      case "team_task_list":
        emptyToolSchema.parse(rawArguments)
        return this.repository.listTasks(caller.teamId)
      case "team_task_create": {
        const input = createTaskToolSchema.parse(rawArguments)
        const owner = input.owner ? this.repository.findMember(caller.teamId, input.owner) : undefined
        if (input.owner && !owner) throw new TeamError("TEAM_MEMBER_NOT_FOUND", "Task owner was not found.", 404)
        const task = this.repository.createTask({
          id: randomUUID(),
          teamId: caller.teamId,
          subject: input.subject,
          description: input.description ?? "",
          status: input.blockedBy?.length ? "blocked" : "pending",
          ...(owner ? { ownerSlotId: owner.slotId } : {}),
          createdBySlotId: caller.slotId,
          blockedBy: input.blockedBy ?? [],
          now: new Date().toISOString(),
        })
        this.eventBus.publish({ teamId: caller.teamId, slotId: caller.slotId, type: "team.task.created", data: task })
        return task
      }
      case "team_task_update": {
        const input = updateTaskToolSchema.parse(rawArguments)
        if (!this.repository.getTask(caller.teamId, input.taskId)) {
          throw new TeamError("TEAM_TASK_NOT_FOUND", "Team task not found.", 404)
        }
        const owner =
          typeof input.owner === "string" ? this.repository.findMember(caller.teamId, input.owner) : undefined
        if (typeof input.owner === "string" && !owner) {
          throw new TeamError("TEAM_MEMBER_NOT_FOUND", "Task owner was not found.", 404)
        }
        const task = this.repository.updateTask(input.taskId, {
          ...(input.subject ? { subject: input.subject } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.owner !== undefined ? { ownerSlotId: owner?.slotId ?? null } : {}),
          ...(input.blockedBy ? { blockedBy: input.blockedBy } : {}),
          updatedAt: new Date().toISOString(),
        })
        this.eventBus.publish({ teamId: caller.teamId, slotId: caller.slotId, type: "team.task.updated", data: task })
        return task
      }
      case "team_spawn_agent": {
        if (caller.role !== "leader") {
          throw new TeamError("TEAM_TOOL_FORBIDDEN", "Only the team leader can add members.", 403)
        }
        const input = spawnAgentToolSchema.parse(rawArguments)
        const team = this.requireSnapshot(caller.teamId)
        const pending = team.spawnRequests.filter((request) => request.status === "pending")
        if (team.members.length >= 8) {
          throw new TeamError("TEAM_MEMBER_LIMIT", "A team can have at most 8 members.", 409)
        }
        if (
          team.members.some((member) => normalizeName(member.name) === normalizeName(input.name)) ||
          pending.some((request) => normalizeName(request.name) === normalizeName(input.name))
        ) {
          throw new TeamError(
            "TEAM_MEMBER_NAME_CONFLICT",
            "Team member names and pending requests must be unique.",
            409,
          )
        }
        if (pending.length >= 8) {
          throw new TeamError("TEAM_SPAWN_REQUEST_LIMIT", "Resolve pending spawn requests before creating more.", 409)
        }
        const request = this.repository.createSpawnRequest({
          id: randomUUID(),
          teamId: caller.teamId,
          requestedBySlotId: caller.slotId,
          name: input.name,
          agent: input.agent,
          ...(input.model ? { model: input.model } : {}),
          now: new Date().toISOString(),
        })
        this.eventBus.publish({
          teamId: caller.teamId,
          slotId: caller.slotId,
          type: "team.spawn.requested",
          data: request,
        })
        return { ...request, approvalRequired: true }
      }
      default:
        throw new TeamError("TEAM_TOOL_NOT_FOUND", "Unknown team tool.", 404)
    }
  }

  async restoreAll(): Promise<void> {
    this.repository.resetInterruptedWork()
    const restoreActions: Array<Promise<void>> = []
    for (const team of this.repository.listSnapshots()) {
      const leader = team.members.find((member) => member.slotId === team.leaderSlotId)
      if (leader?.runtimeStatus === "removing") {
        restoreActions.push(this.delete(team.id))
        continue
      }
      for (const member of team.members) {
        restoreActions.push(
          member.runtimeStatus === "removing"
            ? this.removeMember(team.id, member.slotId)
            : this.monitorMemberRuntime(team.id, member.slotId),
        )
      }
    }
    await Promise.allSettled(restoreActions)
    for (const queued of this.repository.listQueuedSlots()) void this.drainSlot(queued.teamId, queued.slotId)
  }

  async approveSpawnRequest(teamId: string, requestId: string): Promise<TeamMember> {
    return this.withTeamMutation(teamId, async () => {
      this.requireTeam(teamId)
      const request = this.repository.getSpawnRequest(teamId, requestId)
      if (!request) throw new TeamError("TEAM_SPAWN_REQUEST_NOT_FOUND", "Team spawn request not found.", 404)
      if (request.status !== "pending") {
        if (request.status === "approved" && request.memberSlotId) {
          const existing = this.repository.getMember(teamId, request.memberSlotId)
          if (existing) return publicMember(existing)
        }
        throw new TeamError("TEAM_SPAWN_REQUEST_RESOLVED", "Team spawn request is already resolved.", 409)
      }

      let member: TeamMember
      try {
        member = await this.addMemberUnlocked(teamId, {
          name: request.name,
          agent: request.agent,
          ...(request.model ? { model: request.model } : {}),
        })
      } catch (error) {
        const existing = this.repository.findMember(teamId, request.name)
        if (!existing || existing.agent !== request.agent || existing.model !== request.model) throw error
        member = publicMember(existing)
      }
      const resolved = this.repository.updateSpawnRequest(request.id, {
        status: "approved",
        memberSlotId: member.slotId,
        resolvedAt: new Date().toISOString(),
      })
      this.eventBus.publish({
        teamId,
        slotId: request.requestedBySlotId,
        type: "team.spawn.resolved",
        data: resolved,
      })
      return member
    })
  }

  async rejectSpawnRequest(teamId: string, requestId: string): Promise<TeamSpawnRequest> {
    return this.withTeamMutation(teamId, async () => {
      this.requireTeam(teamId)
      const request = this.repository.getSpawnRequest(teamId, requestId)
      if (!request) throw new TeamError("TEAM_SPAWN_REQUEST_NOT_FOUND", "Team spawn request not found.", 404)
      if (request.status !== "pending") {
        throw new TeamError("TEAM_SPAWN_REQUEST_RESOLVED", "Team spawn request is already resolved.", 409)
      }
      const resolved = this.repository.updateSpawnRequest(request.id, {
        status: "rejected",
        resolvedAt: new Date().toISOString(),
      })
      this.eventBus.publish({
        teamId,
        slotId: request.requestedBySlotId,
        type: "team.spawn.resolved",
        data: resolved,
      })
      return resolved
    })
  }

  async prepareRestore(): Promise<void> {
    const managedConversations = this.conversations.listManagedConversations()
    const managedByOwner = new Map(managedConversations.map((conversation) => [conversation.ownerId, conversation.id]))

    for (const snapshot of this.repository.listSnapshots(undefined, true)) {
      const team = this.repository.getTeam(snapshot.id)
      const members = this.repository.listMembers(snapshot.id)
      const leader = members.find((member) => member.slotId === snapshot.leaderSlotId && member.role === "leader")
      const hasValidOwnership = members.every((member) => managedByOwner.get(member.slotId) === member.conversationId)
      if (team?.lifecycleStatus !== "active" || leader?.runtimeStatus === "removing" || !leader || !hasValidOwnership) {
        this.repository.deleteTeam(snapshot.id)
      }
    }

    const validOwnership = new Set<string>()
    for (const team of this.repository.listSnapshots()) {
      for (const member of this.repository.listMembers(team.id)) {
        validOwnership.add(`${member.slotId}:${member.conversationId}`)
      }
    }
    await Promise.allSettled(
      managedConversations
        .filter((conversation) => !validOwnership.has(`${conversation.ownerId}:${conversation.id}`))
        .map((conversation) => this.conversations.deleteManaged(conversation.id, conversation.ownerId)),
    )

    for (const team of this.repository.listSnapshots()) {
      for (const member of this.repository.listMembers(team.id)) {
        this.conversations.configureManagedSession(member.conversationId, member.slotId, {
          ...(member.model ? { model: member.model } : {}),
          systemPrompt: teamRolePrompt({ teamId: team.id, teamName: team.name, member: publicMember(member) }),
          mcpServers: [teamMcpServer(member.mcpToken, member.role)],
        })
      }
    }

    for (const intent of this.repository.listInterruptedIntents()) {
      if (!intent.conversationRunId) continue
      const member = this.repository.getMember(intent.teamId, intent.slotId)
      const message = this.repository.getMessage(intent.messageId)
      if (!member || !message) continue
      try {
        const run = this.conversations.getRun(member.conversationId, intent.conversationRunId)
        if (isTerminalRun(run)) {
          this.finishIntent(intent, message, run)
          this.settleRun(intent.teamRunId)
        }
      } catch {
        // Missing child runs are replayed from the durable Team intent below.
      }
    }

    for (const team of this.repository.listSnapshots()) {
      for (const run of this.repository.listRuns(team.id).filter((candidate) => !isTerminalTeamRun(candidate))) {
        if (this.repository.listRunIntents(run.id).length === 0) this.failIncompleteRun(run)
        else this.settleRun(run.id)
      }
    }
  }

  private queueUserMessage(
    team: Team,
    targetSlotId: string,
    input: SendTeamMessageRequest,
    source: TeamRun["source"],
    intervention: boolean,
  ): TeamMessageReceipt {
    this.requireAvailableMember(team.id, targetSlotId)
    if (input.clientMessageId) {
      const existing = this.repository.findMessageByClientId(team.id, input.clientMessageId)
      if (existing) {
        return {
          teamRunId: existing.teamRunId,
          messageId: existing.id,
          targetSlotId: existing.toSlotId,
          status: "queued",
        }
      }
    }
    const accepted = this.eventBus.transaction(() => {
      let run = this.repository.findActiveRun(team.id)
      if (run && !intervention) {
        throw new TeamError("TEAM_RUN_ACTIVE", "Wait for the active team run to finish before starting another.", 409)
      }
      if (run?.status === "cancelling") {
        throw new TeamError("TEAM_RUN_CANCELLING", "Wait for the active team run to stop before intervening.", 409)
      }
      if (!run) {
        run = this.repository.createRun({
          id: randomUUID(),
          teamId: team.id,
          targetSlotId,
          source,
          hasUserIntervention: intervention,
          now: new Date().toISOString(),
        })
        this.eventBus.publish({ teamId: team.id, teamRunId: run.id, type: "team.run.accepted", data: run })
      } else if (intervention && !run.hasUserIntervention) {
        run = this.repository.updateRun(run.id, { hasUserIntervention: true })
        this.eventBus.publish({ teamId: team.id, teamRunId: run.id, type: "team.run.updated", data: run })
      }
      const message = this.persistMessage({
        teamId: team.id,
        teamRunId: run.id,
        toSlotId: targetSlotId,
        source: "user",
        content: input.message,
        attachments: input.attachments,
        ...(input.clientMessageId ? { clientMessageId: input.clientMessageId } : {}),
      })
      return { run, message }
    })
    void this.drainSlot(team.id, targetSlotId)
    return { teamRunId: accepted.run.id, messageId: accepted.message.id, targetSlotId, status: "queued" }
  }

  private queueMessage(input: {
    teamId: string
    teamRunId: string
    fromSlotId?: string
    toSlotId: string
    source: StoredTeamMessage["source"]
    content: string
    attachments: MessageAttachment[]
    clientMessageId?: string
  }): StoredTeamMessage {
    const message = this.eventBus.transaction(() => this.persistMessage(input))
    void this.drainSlot(input.teamId, input.toSlotId)
    return message
  }

  private persistMessage(input: {
    teamId: string
    teamRunId: string
    fromSlotId?: string
    toSlotId: string
    source: StoredTeamMessage["source"]
    content: string
    attachments: MessageAttachment[]
    clientMessageId?: string
  }): StoredTeamMessage {
    const member = this.requireAvailableMember(input.teamId, input.toSlotId)
    const now = new Date().toISOString()
    const message = this.repository.createMessage({ id: randomUUID(), now, ...input })
    const intent = this.repository.createIntent({
      id: randomUUID(),
      teamId: input.teamId,
      teamRunId: input.teamRunId,
      slotId: input.toSlotId,
      messageId: message.id,
      now,
    })
    this.repository.updateMember(member.slotId, { workStatus: "queued", updatedAt: now })
    this.eventBus.publish({
      teamId: input.teamId,
      teamRunId: input.teamRunId,
      slotId: input.toSlotId,
      type: "team.message.sent",
      data: {
        id: message.id,
        fromSlotId: message.fromSlotId,
        toSlotId: message.toSlotId,
        source: message.source,
        createdAt: message.createdAt,
      },
    })
    this.eventBus.publish({
      teamId: input.teamId,
      teamRunId: input.teamRunId,
      slotId: input.toSlotId,
      type: "team.child-turn.queued",
      data: intent,
    })
    return message
  }

  private async provisionMember(input: {
    teamId: string
    teamName: string
    workspace: string
    slotId: string
    role: "leader" | "teammate"
    name: string
    agent: AddTeamMemberRequest["agent"]
    model?: string
  }): Promise<TeamMember> {
    const mcpToken = randomBytes(32).toString("base64url")
    const memberDraft: TeamMember = {
      slotId: input.slotId,
      teamId: input.teamId,
      conversationId: randomUUID(),
      name: input.name,
      role: input.role,
      agent: input.agent,
      ...(input.model ? { model: input.model } : {}),
      runtimeStatus: "pending",
      workStatus: "idle",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const conversation = await this.conversations.createManaged({
      agent: input.agent,
      workspace: input.workspace,
      owner: { kind: "team_member", id: input.slotId },
      sessionContext: {
        ...(input.model ? { model: input.model } : {}),
        systemPrompt: teamRolePrompt({ teamId: input.teamId, teamName: input.teamName, member: memberDraft }),
        mcpServers: [teamMcpServer(mcpToken, input.role)],
      },
    })
    let member: StoredTeamMember
    try {
      member = this.repository.createMember({
        slotId: input.slotId,
        teamId: input.teamId,
        conversationId: conversation.id,
        name: input.name,
        role: input.role,
        agent: input.agent,
        ...(input.model ? { model: input.model } : {}),
        mcpToken,
        runtimeStatus: "pending",
        workStatus: "idle",
        now: new Date().toISOString(),
      })
    } catch (error) {
      await this.conversations.deleteManaged(conversation.id, input.slotId).catch(() => undefined)
      throw error
    }
    const publicValue = publicMember(member)
    this.eventBus.publish({ teamId: input.teamId, slotId: input.slotId, type: "team.member.added", data: publicValue })
    this.refreshSessionStatus(input.teamId)
    void this.monitorMemberRuntime(input.teamId, input.slotId)
    return publicValue
  }

  private async monitorMemberRuntime(teamId: string, slotId: string): Promise<void> {
    const member = this.repository.getMember(teamId, slotId)
    if (!member) return
    try {
      await this.conversations.waitUntilReady(member.conversationId)
      const current = this.repository.getMember(teamId, slotId)
      if (!current) return
      const updated = this.repository.updateMember(slotId, {
        runtimeStatus: "ready",
        error: null,
        updatedAt: new Date().toISOString(),
      })
      this.eventBus.publish({ teamId, slotId, type: "team.member.updated", data: publicMember(updated) })
      this.refreshSessionStatus(teamId)
      void this.drainSlot(teamId, slotId)
    } catch (error) {
      const current = this.repository.getMember(teamId, slotId)
      if (!current) return
      const updated = this.repository.updateMember(slotId, {
        runtimeStatus: "failed",
        workStatus: "blocked",
        error: errorMessage(error),
        updatedAt: new Date().toISOString(),
      })
      this.eventBus.publish({ teamId, slotId, type: "team.member.updated", data: publicMember(updated) })
      this.refreshSessionStatus(teamId)
      void this.drainSlot(teamId, slotId)
    }
  }

  private refreshSessionStatus(teamId: string): void {
    const team = this.repository.getSnapshot(teamId)
    if (!team) return
    const status = team.members.some((member) => member.runtimeStatus === "failed")
      ? "failed"
      : team.members.every((member) => member.runtimeStatus === "ready")
        ? "ready"
        : "starting"
    const error = status === "failed" ? "One or more team members failed to start." : null
    const updated = this.repository.updateTeam(teamId, {
      sessionStatus: status,
      error,
      updatedAt: new Date().toISOString(),
    })
    this.eventBus.publish({ teamId, type: "team.session.updated", data: updated })
  }

  private async drainSlot(teamId: string, slotId: string): Promise<void> {
    const key = `${teamId}:${slotId}`
    if (this.processingSlots.has(key)) return
    this.processingSlots.add(key)
    try {
      let member = this.repository.getMember(teamId, slotId)
      if (!member || member.runtimeStatus === "pending") return
      let intent = this.repository.claimNextQueuedIntent(teamId, slotId, new Date().toISOString())
      if (member.runtimeStatus === "failed") {
        while (intent) {
          const now = new Date().toISOString()
          const failed = this.repository.transitionIntent(intent.id, "running", {
            status: "failed",
            error: member.error ?? "Member runtime failed.",
            completedAt: now,
          })
          if (failed) {
            this.repository.updateMessageStatus(intent.messageId, "cancelled", now)
            this.settleRun(intent.teamRunId)
          }
          intent = this.repository.claimNextQueuedIntent(teamId, slotId, new Date().toISOString())
        }
        return
      }

      while (intent) {
        member = this.repository.getMember(teamId, slotId)
        const team = this.repository.getTeam(teamId)
        const message = this.repository.getMessage(intent.messageId)
        const teamRun = this.repository.getRun(teamId, intent.teamRunId)
        if (!member || !team || !message || !teamRun) {
          const now = new Date().toISOString()
          const failed = this.repository.transitionIntent(intent.id, "running", {
            status: "failed",
            error: "Team work dependencies disappeared before execution.",
            completedAt: now,
          })
          if (failed) {
            if (message) this.repository.updateMessageStatus(message.id, "cancelled", now)
            this.settleRun(intent.teamRunId)
          }
          break
        }
        if (teamRun.status === "cancelling") {
          const now = new Date().toISOString()
          const cancelled = this.repository.transitionIntent(intent.id, "running", {
            status: "cancelled",
            completedAt: now,
          })
          if (cancelled) {
            this.repository.updateMessageStatus(message.id, "cancelled", now)
            this.settleRun(teamRun.id)
          }
          intent = this.repository.claimNextQueuedIntent(teamId, slotId, new Date().toISOString())
          continue
        }

        const startedAt = intent.startedAt ?? new Date().toISOString()
        const runningMember = this.repository.updateMember(slotId, { workStatus: "running", updatedAt: startedAt })
        this.eventBus.publish({ teamId, slotId, type: "team.member.updated", data: publicMember(runningMember) })
        if (teamRun.status === "accepted") {
          const running = this.repository.updateRun(teamRun.id, { status: "running", startedAt })
          this.eventBus.publish({ teamId, teamRunId: teamRun.id, type: "team.run.started", data: running })
        }

        try {
          const senderName = message.fromSlotId
            ? (this.repository.getMember(teamId, message.fromSlotId)?.name ?? "Former teammate")
            : "User"
          const conversationRun = await this.conversations.createManagedRun(member.conversationId, member.slotId, {
            message: teamWakePrompt({
              teamName: team.name,
              recipient: publicMember(member),
              senderName,
              source: message.source,
              content: message.content,
            }),
            attachments: message.attachments,
          })
          const linkedIntent = this.repository.transitionIntent(intent.id, "running", {
            conversationRunId: conversationRun.id,
          })
          if (!linkedIntent) {
            await this.conversations.cancelRun(member.conversationId, conversationRun.id)
            this.settleRun(teamRun.id)
            return
          }
          this.eventBus.publish({
            teamId,
            teamRunId: teamRun.id,
            slotId,
            type: "team.child-turn.started",
            data: { intentId: intent.id, conversationId: member.conversationId, conversationRunId: conversationRun.id },
          })
          const result = await this.conversations.waitForRun(member.conversationId, conversationRun.id)
          this.finishIntent(intent, message, result)
        } catch (error) {
          const now = new Date().toISOString()
          const failed = this.repository.transitionIntent(intent.id, "running", {
            status: "failed",
            error: errorMessage(error),
            completedAt: now,
          })
          if (failed) {
            this.repository.updateMessageStatus(message.id, "cancelled", now)
            this.eventBus.publish({
              teamId,
              teamRunId: teamRun.id,
              slotId,
              type: "team.child-turn.failed",
              data: failed,
            })
          }
        }
        this.settleRun(teamRun.id)
        intent = this.repository.claimNextQueuedIntent(teamId, slotId, new Date().toISOString())
      }
    } finally {
      const member = this.repository.getMember(teamId, slotId)
      if (member && member.runtimeStatus !== "failed" && member.runtimeStatus !== "removing") {
        const workStatus = this.repository.findRunningIntent(teamId, slotId)
          ? "running"
          : this.repository.nextQueuedIntent(teamId, slotId)
            ? "queued"
            : "idle"
        const updated = this.repository.updateMember(slotId, { workStatus, updatedAt: new Date().toISOString() })
        this.eventBus.publish({ teamId, slotId, type: "team.member.updated", data: publicMember(updated) })
      }
      this.processingSlots.delete(key)
      if (
        this.repository.getMember(teamId, slotId) &&
        !this.repository.findRunningIntent(teamId, slotId) &&
        this.repository.nextQueuedIntent(teamId, slotId)
      ) {
        void this.drainSlot(teamId, slotId)
      }
    }
  }

  private finishIntent(intent: StoredWorkIntent, message: StoredTeamMessage, result: Run): void {
    const now = new Date().toISOString()
    const status = result.status === "completed" ? "completed" : result.status === "cancelled" ? "cancelled" : "failed"
    const completed = this.repository.transitionIntent(intent.id, "running", {
      status,
      error: result.error ?? null,
      completedAt: now,
    })
    if (!completed) return
    this.repository.updateMessageStatus(message.id, status === "completed" ? "delivered" : "cancelled", now)
    this.eventBus.publish({
      teamId: intent.teamId,
      teamRunId: intent.teamRunId,
      slotId: intent.slotId,
      type:
        status === "completed"
          ? "team.child-turn.completed"
          : status === "cancelled"
            ? "team.child-turn.cancelled"
            : "team.child-turn.failed",
      data: completed,
    })
  }

  private settleRun(runId: string): void {
    const intents = this.repository.listRunIntents(runId)
    if (intents.some((intent) => intent.status === "queued" || intent.status === "running")) return
    const first = intents[0]
    if (!first) return
    const run = this.repository.getRun(first.teamId, runId)
    if (!run || isTerminalTeamRun(run)) return
    const completedAt = new Date().toISOString()
    const status =
      run.status === "cancelling"
        ? "cancelled"
        : intents.some((intent) => intent.status === "failed")
          ? "failed"
          : intents.every((intent) => intent.status === "cancelled")
            ? "cancelled"
            : "completed"
    const error = status === "failed" ? (intents.find((intent) => intent.error)?.error ?? "Team work failed.") : null
    const completed = this.repository.updateRun(runId, { status, error, completedAt })
    this.eventBus.publish({
      teamId: run.teamId,
      teamRunId: run.id,
      type:
        status === "completed"
          ? "team.run.completed"
          : status === "cancelled"
            ? "team.run.cancelled"
            : "team.run.failed",
      data: completed,
    })
  }

  private failIncompleteRun(run: TeamRun): void {
    const failed = this.repository.updateRun(run.id, {
      status: "failed",
      error: "The server stopped before this team run accepted any work.",
      completedAt: new Date().toISOString(),
    })
    this.eventBus.publish({ teamId: run.teamId, teamRunId: run.id, type: "team.run.failed", data: failed })
  }

  private requireSnapshot(teamId: string): Team {
    const team = this.repository.getSnapshot(teamId)
    if (!team) throw new TeamError("TEAM_NOT_FOUND", "Team not found.", 404)
    return team
  }

  private requireTeam(teamId: string) {
    const team = this.repository.getTeam(teamId)
    if (!team) throw new TeamError("TEAM_NOT_FOUND", "Team not found.", 404)
    return team
  }

  private requireMember(teamId: string, slotId: string): StoredTeamMember {
    const member = this.repository.getMember(teamId, slotId)
    if (!member) throw new TeamError("TEAM_MEMBER_NOT_FOUND", "Team member not found.", 404)
    return member
  }

  private requireAvailableMember(teamId: string, slotId: string): StoredTeamMember {
    const member = this.requireMember(teamId, slotId)
    if (member.runtimeStatus === "removing") {
      throw new TeamError("TEAM_MEMBER_REMOVING", "This team member is being removed.", 409)
    }
    return member
  }

  private requireRun(teamId: string, runId: string): TeamRun {
    const run = this.repository.getRun(teamId, runId)
    if (!run) throw new TeamError("TEAM_RUN_NOT_FOUND", "Team run not found.", 404)
    return run
  }

  private async withTeamMutation<T>(teamId: string, action: () => Promise<T>): Promise<T> {
    const previous = this.mutationTails.get(teamId) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate
    })
    const tail = previous.catch(() => undefined).then(() => gate)
    this.mutationTails.set(teamId, tail)
    await previous.catch(() => undefined)
    try {
      return await action()
    } finally {
      release()
      if (this.mutationTails.get(teamId) === tail) this.mutationTails.delete(teamId)
    }
  }
}

function publicMember(member: StoredTeamMember): TeamMember {
  const { mcpToken: _mcpToken, ...value } = member
  return value
}

function teamMcpServer(
  token: string,
  role: TeamMember["role"],
): NonNullable<ManagedConversationInput["sessionContext"]["mcpServers"]>[number] {
  const sourceRuntime = import.meta.url.endsWith(".ts")
  const bridgePath = fileURLToPath(
    new URL(sourceRuntime ? "./mcp/team-mcp-stdio.ts" : "./mcp/team-mcp-stdio.js", import.meta.url),
  )
  const bridgeArgs = sourceRuntime ? ["--import", import.meta.resolve("tsx"), bridgePath] : [bridgePath]
  const host = environment.host === "0.0.0.0" || environment.host === "::" ? "127.0.0.1" : environment.host
  return {
    name: "agent-weave-team",
    command: process.execPath,
    args: bridgeArgs,
    env: {
      AGENT_WEAVE_TEAM_API: `http://${host}:${environment.port}/api/v1/internal/team-tools`,
      AGENT_WEAVE_TEAM_TOKEN: token,
      AGENT_WEAVE_TEAM_ROLE: role,
    },
  }
}

function assertUniqueMemberNames(names: string[]): void {
  const normalized = names.map(normalizeName)
  if (new Set(normalized).size !== normalized.length) {
    throw new TeamError("TEAM_MEMBER_NAME_CONFLICT", "Team member names must be unique.", 409)
  }
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase("en-US")
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function hashControlToken(token: string): Buffer {
  return createHash("sha256").update(token).digest()
}

function isTerminalTeamRun(run: TeamRun): boolean {
  return run.status === "completed" || run.status === "cancelled" || run.status === "failed"
}

function isTerminalRun(run: Run): boolean {
  return run.status === "completed" || run.status === "cancelled" || run.status === "failed"
}

const emptyToolSchema = z.object({}).passthrough()
const sendMessageToolSchema = z.object({
  target: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(100_000),
})
const createTaskToolSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10_000).optional(),
  owner: z.string().trim().min(1).max(120).optional(),
  blockedBy: z.array(z.string().uuid()).max(50).optional(),
})
const updateTaskToolSchema = z.object({
  taskId: z.string().uuid(),
  subject: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(10_000).optional(),
  status: teamTaskStatusSchema.optional(),
  owner: z.string().trim().min(1).max(120).nullable().optional(),
  blockedBy: z.array(z.string().uuid()).max(50).optional(),
})
const spawnAgentToolSchema = z.object({
  name: z.string().trim().min(1).max(80),
  agent: agentProviderSchema,
  model: z.string().trim().min(1).max(200).optional(),
})

const mutatingTeamTools = new Set(["team_send_message", "team_task_create", "team_task_update", "team_spawn_agent"])

function canonicalToolRequestId(requestId: string | number): string {
  return `${typeof requestId}:${JSON.stringify(requestId)}`
}

export const teamService = new TeamService(teamRepository, conversationService, teamEventBus, teamToolCallRepository)
