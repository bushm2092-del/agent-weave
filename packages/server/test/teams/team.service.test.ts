import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"
import { DatabaseSync } from "node:sqlite"
import { ConversationEventBus } from "../../src/features/conversations/conversation-event-bus.js"
import { ConversationService } from "../../src/features/conversations/conversation.service.js"
import type { AgentGateway } from "../../src/features/conversations/gateways/agent.gateway.js"
import { SqliteConversationRepository } from "../../src/features/conversations/persistence/sqlite-conversation.repository.js"
import { TeamEventBus } from "../../src/features/teams/team-event-bus.js"
import { SqliteTeamRepository } from "../../src/features/teams/persistence/sqlite-team.repository.js"
import { TeamService } from "../../src/features/teams/team.service.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe("TeamService", () => {
  it("provisions independent member conversations and completes a team run", async () => {
    const harness = await createHarness()
    const team = await harness.service.create({
      canvasId: "canvas-one",
      name: "Review team",
      workspace: harness.workspace,
      leader: { name: "Lead", agent: "codex" },
      members: [{ name: "Reviewer", agent: "pi" }],
    })

    await waitFor(() => harness.service.get(team.id).sessionStatus === "ready")
    const receipt = harness.service.sendTeamMessage(team.id, { message: "Review the change", attachments: [] })
    await waitFor(() => harness.service.listRuns(team.id)[0]?.status === "completed")

    const snapshot = harness.service.get(team.id)
    assert.equal(snapshot.members.length, 2)
    assert.equal(new Set(snapshot.members.map((member) => member.conversationId)).size, 2)
    assert.equal(snapshot.activeRun, undefined)
    assert.equal(harness.teamRepository.listRunIntents(receipt.teamRunId).length, 1)
    assert.equal(harness.teamRepository.listRunIntents(receipt.teamRunId)[0]?.status, "completed")
  })

  it("inherits the active run when an authenticated leader messages a teammate", async () => {
    let releaseLeader: (() => void) | undefined
    const leaderGate = new Promise<void>((resolve) => {
      releaseLeader = resolve
    })
    let holdLeader = true
    const harness = await createHarness(async (input) => {
      if (holdLeader && input.systemPrompt?.includes("team leader")) {
        holdLeader = false
        await leaderGate
      }
      await input.emit({ type: "assistant.delta", data: { text: "Done" } })
      return { content: "Done", configOptions: [] }
    })
    const team = await harness.service.create({
      canvasId: "canvas-two",
      name: "Delivery team",
      workspace: harness.workspace,
      leader: { name: "Lead", agent: "codex" },
      members: [{ name: "Worker", agent: "pi" }],
    })
    await waitFor(() => harness.service.get(team.id).sessionStatus === "ready")
    const receipt = harness.service.sendTeamMessage(team.id, { message: "Build it", attachments: [] })
    await waitFor(() => harness.service.listRuns(team.id)[0]?.status === "running")

    const leader = harness.teamRepository.getMember(team.id, team.leaderSlotId)!
    const sent = (await harness.service.executeTool(leader.mcpToken, "team_send_message", {
      target: "Worker",
      message: "Implement the worker portion",
    })) as { teamRunId: string }
    releaseLeader?.()
    await waitFor(() => harness.service.listRuns(team.id)[0]?.status === "completed")

    assert.equal(sent.teamRunId, receipt.teamRunId)
    assert.equal(harness.teamRepository.listRunIntents(receipt.teamRunId).length, 2)
    assert.deepEqual(
      harness.teamRepository.listRunIntents(receipt.teamRunId).map((intent) => intent.status),
      ["completed", "completed"],
    )
  })

  it("protects team-owned conversations and deletes them through the team lifecycle", async () => {
    const harness = await createHarness()
    const team = await harness.service.create({
      canvasId: "canvas-three",
      name: "Ops team",
      workspace: harness.workspace,
      leader: { name: "Lead", agent: "codex" },
      members: [],
    })
    const member = team.members[0]!

    await assert.rejects(harness.conversations.delete(member.conversationId), { code: "MANAGED_CONVERSATION" })
    await harness.service.delete(team.id)

    assert.throws(() => harness.service.get(team.id), { code: "TEAM_NOT_FOUND" })
    assert.throws(() => harness.conversations.get(member.conversationId), { code: "CONVERSATION_NOT_FOUND" })
  })

  it("cancels all member work and clears task ownership when a teammate is removed", async () => {
    let releaseWorker: (() => void) | undefined
    const workerGate = new Promise<void>((resolve) => {
      releaseWorker = resolve
    })
    let releaseCancellation: (() => void) | undefined
    const cancellationGate = new Promise<void>((resolve) => {
      releaseCancellation = resolve
    })
    const harness = await createHarness(async (input) => {
      if (input.systemPrompt?.includes("You are a teammate")) await workerGate
      return { content: "Done", configOptions: [] }
    })
    harness.gateway.cancelRun = async () => cancellationGate
    const team = await harness.service.create({
      canvasId: "canvas-four",
      name: "Removal team",
      workspace: harness.workspace,
      leader: { name: "Lead", agent: "codex" },
      members: [{ name: "Worker", agent: "pi" }],
    })
    await waitFor(() => harness.service.get(team.id).sessionStatus === "ready")
    const leader = harness.teamRepository.getMember(team.id, team.leaderSlotId)!
    const worker = team.members.find((member) => member.name === "Worker")!
    await harness.service.executeTool(leader.mcpToken, "team_task_create", {
      subject: "Owned work",
      owner: worker.name,
    })
    const receipt = harness.service.sendMemberMessage(team.id, worker.slotId, {
      message: "First item",
      attachments: [],
    })
    await waitFor(() => harness.teamRepository.findRunningIntent(team.id, worker.slotId) !== undefined)
    harness.service.sendMemberMessage(team.id, worker.slotId, { message: "Second item", attachments: [] })
    await waitFor(() => harness.teamRepository.listRunIntents(receipt.teamRunId).length === 2)

    const removal = harness.service.removeMember(team.id, worker.slotId)
    await waitFor(() => harness.teamRepository.getMember(team.id, worker.slotId)?.runtimeStatus === "removing")
    assert.throws(
      () => harness.service.sendMemberMessage(team.id, worker.slotId, { message: "Late item", attachments: [] }),
      { code: "TEAM_MEMBER_REMOVING" },
    )
    releaseCancellation?.()
    await removal
    releaseWorker?.()

    assert.equal(
      harness.service.get(team.id).members.some((member) => member.slotId === worker.slotId),
      false,
    )
    assert.deepEqual(
      harness.teamRepository.listRunIntents(receipt.teamRunId).map((intent) => intent.status),
      ["cancelled", "cancelled"],
    )
    assert.equal(harness.service.listRuns(team.id)[0]?.status, "cancelled")
    assert.equal(harness.service.get(team.id).tasks[0]?.ownerSlotId, undefined)
  })

  it("rolls back the managed conversation when concurrent member creation conflicts", async () => {
    const harness = await createHarness()
    const team = await harness.service.create({
      canvasId: "canvas-five",
      name: "Concurrent team",
      workspace: harness.workspace,
      leader: { name: "Lead", agent: "codex" },
      members: [],
    })
    await waitFor(() => harness.service.get(team.id).sessionStatus === "ready")

    const results = await Promise.allSettled([
      harness.service.addMember(team.id, { name: "Builder", agent: "codex" }),
      harness.service.addMember(team.id, { name: "Builder", agent: "pi" }),
    ])

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
    assert.equal(results.filter((result) => result.status === "rejected").length, 1)
    assert.equal(harness.conversationRepository.listRestorableConversations().length, 2)
    assert.equal(harness.service.get(team.id).members.length, 2)
  })

  it("serializes concurrent additions so the member limit cannot be exceeded", async () => {
    const harness = await createHarness()
    const team = await harness.service.create({
      canvasId: "canvas-six",
      name: "Bounded team",
      workspace: harness.workspace,
      leader: { name: "Lead", agent: "codex" },
      members: Array.from({ length: 6 }, (_, index) => ({ name: `Initial ${index + 1}`, agent: "pi" as const })),
    })
    await waitFor(() => harness.service.get(team.id).sessionStatus === "ready")
    const competingRepository = new SqliteTeamRepository(harness.database)
    const competingService = new TeamService(
      competingRepository,
      harness.conversations,
      new TeamEventBus(competingRepository),
    )

    const results = await Promise.allSettled([
      harness.service.addMember(team.id, { name: "Concurrent 1", agent: "codex" }),
      competingService.addMember(team.id, { name: "Concurrent 2", agent: "codex" }),
    ])

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1)
    assert.equal(results.find((result) => result.status === "rejected")?.reason.code, "TEAM_MEMBER_LIMIT")
    assert.equal(harness.service.get(team.id).members.length, 8)
    assert.equal(harness.conversationRepository.listRestorableConversations().length, 8)
  })

  it("atomically claims one queued intent per slot and preserves cancellation against stale completion", async () => {
    const harness = await createHarness()
    const team = await harness.service.create({
      canvasId: "canvas-intent-cas",
      name: "Intent CAS team",
      workspace: harness.workspace,
      leader: { name: "Lead", agent: "codex" },
      members: [],
    })
    await waitFor(() => harness.service.get(team.id).sessionStatus === "ready")
    const member = harness.teamRepository.getMember(team.id, team.leaderSlotId)!
    const run = harness.teamRepository.createRun({
      id: crypto.randomUUID(),
      teamId: team.id,
      targetSlotId: member.slotId,
      source: "team_message",
      hasUserIntervention: false,
      now: "2026-01-01T00:00:00.000Z",
    })
    const createIntent = (createdAt: string) => {
      const message = harness.teamRepository.createMessage({
        id: crypto.randomUUID(),
        teamId: team.id,
        teamRunId: run.id,
        toSlotId: member.slotId,
        source: "user",
        content: "Queued work",
        attachments: [],
        now: createdAt,
      })
      return harness.teamRepository.createIntent({
        id: crypto.randomUUID(),
        teamId: team.id,
        teamRunId: run.id,
        slotId: member.slotId,
        messageId: message.id,
        now: createdAt,
      })
    }
    const first = createIntent("2026-01-01T00:00:00.001Z")
    const second = createIntent("2026-01-01T00:00:00.002Z")
    const competingRepository = new SqliteTeamRepository(harness.database)

    const claimed = harness.teamRepository.claimNextQueuedIntent(team.id, member.slotId, "2026-01-01T00:00:01.000Z")
    assert.equal(claimed?.id, first.id)
    assert.equal(
      competingRepository.claimNextQueuedIntent(team.id, member.slotId, "2026-01-01T00:00:01.001Z"),
      undefined,
    )

    const cancelled = competingRepository.transitionIntent(first.id, "running", {
      status: "cancelled",
      completedAt: "2026-01-01T00:00:02.000Z",
    })
    assert.equal(cancelled?.status, "cancelled")
    assert.equal(
      harness.teamRepository.transitionIntent(first.id, "running", {
        status: "completed",
        completedAt: "2026-01-01T00:00:03.000Z",
      }),
      undefined,
    )
    assert.equal(harness.teamRepository.getIntent(first.id)?.status, "cancelled")
    assert.equal(
      competingRepository.claimNextQueuedIntent(team.id, member.slotId, "2026-01-01T00:00:04.000Z")?.id,
      second.id,
    )
  })

  it("rolls back task rows and dependency changes when dependency persistence fails", async () => {
    const harness = await createHarness()
    const team = await harness.service.create({
      canvasId: "canvas-task-transaction",
      name: "Transactional task team",
      workspace: harness.workspace,
      leader: { name: "Lead", agent: "codex" },
      members: [],
    })
    await waitFor(() => harness.service.get(team.id).sessionStatus === "ready")
    const now = "2026-01-01T00:00:00.000Z"
    const blocker = harness.teamRepository.createTask({
      id: crypto.randomUUID(),
      teamId: team.id,
      subject: "Blocker",
      description: "",
      status: "pending",
      blockedBy: [],
      now,
    })
    const target = harness.teamRepository.createTask({
      id: crypto.randomUUID(),
      teamId: team.id,
      subject: "Original subject",
      description: "",
      status: "pending",
      blockedBy: [],
      now,
    })
    harness.database.exec(`
      CREATE TRIGGER fail_team_task_dependency
      BEFORE INSERT ON team_task_dependencies
      BEGIN
        SELECT RAISE(ABORT, 'forced dependency write failure');
      END;
    `)
    const failedCreateId = crypto.randomUUID()

    harness.teamRepository.transaction(() => {
      assert.throws(
        () =>
          harness.teamRepository.createTask({
            id: failedCreateId,
            teamId: team.id,
            subject: "Must roll back",
            description: "",
            status: "blocked",
            blockedBy: [blocker.id],
            now,
          }),
        /forced dependency write failure/,
      )
      assert.throws(
        () =>
          harness.teamRepository.updateTask(target.id, {
            subject: "Must also roll back",
            blockedBy: [blocker.id],
            updatedAt: "2026-01-01T00:00:01.000Z",
          }),
        /forced dependency write failure/,
      )
    })

    assert.equal(harness.teamRepository.getTask(team.id, failedCreateId), undefined)
    assert.equal(harness.teamRepository.getTask(team.id, target.id)?.subject, "Original subject")
    assert.deepEqual(harness.teamRepository.getTask(team.id, target.id)?.blockedBy, [])
  })

  it("allows only one top-level team run at a time", async () => {
    let releaseLeader: (() => void) | undefined
    const leaderGate = new Promise<void>((resolve) => {
      releaseLeader = resolve
    })
    const harness = await createHarness(async (input) => {
      if (input.systemPrompt?.includes("team leader")) await leaderGate
      return { content: "Done", configOptions: [] }
    })
    const team = await harness.service.create({
      canvasId: "canvas-seven",
      name: "Single run team",
      workspace: harness.workspace,
      leader: { name: "Lead", agent: "codex" },
      members: [],
    })
    await waitFor(() => harness.service.get(team.id).sessionStatus === "ready")
    harness.service.sendTeamMessage(team.id, { message: "First goal", attachments: [] })
    await waitFor(() => harness.service.listRuns(team.id)[0]?.status === "running")

    assert.throws(() => harness.service.sendTeamMessage(team.id, { message: "Second goal", attachments: [] }), {
      code: "TEAM_RUN_ACTIVE",
    })
    assert.equal(harness.service.listRuns(team.id).length, 1)
    releaseLeader?.()
    await waitFor(() => harness.service.listRuns(team.id)[0]?.status === "completed")
  })

  it("finishes an interrupted whole-team deletion from its lifecycle tombstone", async () => {
    const harness = await createHarness()
    const team = await harness.service.create({
      canvasId: "canvas-eight",
      name: "Deleting team",
      workspace: harness.workspace,
      leader: { name: "Lead", agent: "codex" },
      members: [{ name: "Worker", agent: "pi" }],
    })
    await waitFor(() => harness.service.get(team.id).sessionStatus === "ready")
    const now = new Date().toISOString()
    harness.teamRepository.updateTeam(team.id, { lifecycleStatus: "deleting", updatedAt: now })

    await harness.service.prepareRestore()

    assert.throws(() => harness.service.get(team.id), { code: "TEAM_NOT_FOUND" })
    assert.equal(harness.conversationRepository.listRestorableConversations().length, 0)
  })

  it("reconciles a completed child run before replaying interrupted team work", async () => {
    const harness = await createHarness()
    const team = await harness.service.create({
      canvasId: "canvas-nine",
      name: "Recovery team",
      workspace: harness.workspace,
      leader: { name: "Lead", agent: "codex" },
      members: [],
    })
    await waitFor(() => harness.service.get(team.id).sessionStatus === "ready")
    const member = harness.teamRepository.getMember(team.id, team.leaderSlotId)!
    const now = new Date().toISOString()
    const teamRun = harness.teamRepository.createRun({
      id: crypto.randomUUID(),
      teamId: team.id,
      targetSlotId: member.slotId,
      source: "team_message",
      hasUserIntervention: false,
      now,
    })
    harness.teamRepository.updateRun(teamRun.id, { status: "running", startedAt: now })
    const message = harness.teamRepository.createMessage({
      id: crypto.randomUUID(),
      teamId: team.id,
      teamRunId: teamRun.id,
      toSlotId: member.slotId,
      source: "user",
      content: "Recovered work",
      attachments: [],
      now,
    })
    const childRun = harness.conversationRepository.createRun({
      id: crypto.randomUUID(),
      conversationId: member.conversationId,
      message: "Recovered child work",
      attachments: [],
      now,
    })
    harness.conversationRepository.updateRun(childRun.id, { status: "completed", completedAt: now })
    const intent = harness.teamRepository.createIntent({
      id: crypto.randomUUID(),
      teamId: team.id,
      teamRunId: teamRun.id,
      slotId: member.slotId,
      messageId: message.id,
      now,
    })
    harness.teamRepository.updateIntent(intent.id, {
      status: "running",
      conversationRunId: childRun.id,
      startedAt: now,
    })

    await harness.service.prepareRestore()

    assert.equal(harness.teamRepository.getIntent(intent.id)?.status, "completed")
    assert.equal(harness.service.listRuns(team.id)[0]?.status, "completed")
  })

  it("requires explicit approval before a leader spawn request creates a member", async () => {
    const harness = await createHarness()
    const team = await harness.service.create({
      canvasId: "canvas-ten",
      name: "Approval team",
      workspace: harness.workspace,
      leader: { name: "Lead", agent: "codex" },
      members: [],
    })
    await waitFor(() => harness.service.get(team.id).sessionStatus === "ready")
    const leader = harness.teamRepository.getMember(team.id, team.leaderSlotId)!

    const request = (await harness.service.executeTool(leader.mcpToken, "team_spawn_agent", {
      name: "Builder",
      agent: "pi",
    })) as { id: string; status: string; approvalRequired: boolean }

    assert.equal(request.status, "pending")
    assert.equal(request.approvalRequired, true)
    assert.equal(harness.service.get(team.id).members.length, 1)
    assert.equal(harness.service.get(team.id).spawnRequests[0]?.status, "pending")

    const member = await harness.service.approveSpawnRequest(team.id, request.id)

    assert.equal(member.name, "Builder")
    assert.equal(harness.service.get(team.id).members.length, 2)
    assert.equal(harness.service.get(team.id).spawnRequests[0]?.status, "approved")
  })
})

async function createHarness(run?: AgentGateway["run"]) {
  const workspace = await mkdtemp(join(tmpdir(), "agent-weave-team-"))
  temporaryDirectories.push(workspace)
  const database = new DatabaseSync(":memory:")
  const conversationRepository = new SqliteConversationRepository(database)
  const teamRepository = new SqliteTeamRepository(database)
  const gateway = createGateway()
  if (run) gateway.run = run
  const conversations = new ConversationService(
    gateway,
    conversationRepository,
    new ConversationEventBus(conversationRepository),
  )
  const service = new TeamService(teamRepository, conversations, new TeamEventBus(teamRepository))
  return { database, workspace, conversations, conversationRepository, gateway, service, teamRepository }
}

function createGateway(): AgentGateway {
  return {
    async initializeSession() {
      return { state: "created", configOptions: [] }
    },
    async getConfigOptions() {
      return []
    },
    async setConfigOption() {
      return []
    },
    async run(input) {
      await input.emit({ type: "assistant.delta", data: { text: "Done" } })
      return { content: "Done", configOptions: [] }
    },
    async decidePermission() {},
    async cancelRun() {},
    async closeSession() {},
  }
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error("Condition was not reached")
}
