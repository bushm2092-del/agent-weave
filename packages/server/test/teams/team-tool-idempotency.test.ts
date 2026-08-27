import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { afterEach, describe, it } from "node:test"
import { ConversationEventBus } from "../../src/features/conversations/conversation-event-bus.js"
import { ConversationService } from "../../src/features/conversations/conversation.service.js"
import type { AgentGateway } from "../../src/features/conversations/gateways/agent.gateway.js"
import { SqliteConversationRepository } from "../../src/features/conversations/persistence/sqlite-conversation.repository.js"
import { TeamEventBus } from "../../src/features/teams/team-event-bus.js"
import { SqliteTeamRepository } from "../../src/features/teams/persistence/sqlite-team.repository.js"
import { SqliteTeamToolCallRepository } from "../../src/features/teams/persistence/team-tool-call.repository.js"
import { TeamService } from "../../src/features/teams/team.service.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe("Team MCP tool idempotency", () => {
  it("persists task and spawn results by caller, request ID, and tool name", async () => {
    const harness = await createHarness()
    const team = await harness.service.create({
      canvasId: "idempotency-canvas",
      name: "Idempotency team",
      workspace: harness.workspace,
      leader: { name: "Lead", agent: "codex" },
      members: [],
    })
    await waitFor(() => harness.service.get(team.id).sessionStatus === "ready")
    const leader = harness.teamRepository.getMember(team.id, team.leaderSlotId)!

    const task = await harness.service.executeTool(
      leader.mcpToken,
      "team_task_create",
      { subject: "Original task" },
      "rpc-42",
    )
    const restartedService = new TeamService(
      harness.teamRepository,
      harness.conversations,
      new TeamEventBus(harness.teamRepository),
      new SqliteTeamToolCallRepository(harness.database),
    )
    const retriedTask = await restartedService.executeTool(
      leader.mcpToken,
      "team_task_create",
      { subject: "Changed retry payload" },
      "rpc-42",
    )

    assert.deepEqual(retriedTask, task)
    assert.equal(harness.teamRepository.listTasks(team.id).length, 1)
    assert.equal(harness.teamRepository.listTasks(team.id)[0]?.subject, "Original task")

    const spawn = await restartedService.executeTool(
      leader.mcpToken,
      "team_spawn_agent",
      { name: "Builder", agent: "pi" },
      "rpc-42",
    )
    const retriedSpawn = await harness.service.executeTool(
      leader.mcpToken,
      "team_spawn_agent",
      { name: "Different retry name", agent: "codex" },
      "rpc-42",
    )

    assert.deepEqual(retriedSpawn, spawn)
    assert.equal(harness.teamRepository.listSpawnRequests(team.id).length, 1)
    assert.equal(harness.teamRepository.listSpawnRequests(team.id)[0]?.name, "Builder")

    await restartedService.executeTool(leader.mcpToken, "team_task_create", { subject: "Unkeyed task" })
    await restartedService.executeTool(leader.mcpToken, "team_task_create", { subject: "Unkeyed task" })
    assert.equal(harness.teamRepository.listTasks(team.id).length, 3)
  })

  it("returns one queued message for repeated numeric MCP request IDs", async () => {
    const harness = await createHarness()
    const team = await harness.service.create({
      canvasId: "message-idempotency-canvas",
      name: "Message team",
      workspace: harness.workspace,
      leader: { name: "Lead", agent: "codex" },
      members: [{ name: "Worker", agent: "pi" }],
    })
    await waitFor(() => harness.service.get(team.id).sessionStatus === "ready")
    const leader = harness.teamRepository.getMember(team.id, team.leaderSlotId)!
    const now = new Date().toISOString()
    const run = harness.teamRepository.createRun({
      id: randomUUID(),
      teamId: team.id,
      targetSlotId: leader.slotId,
      source: "team_message",
      hasUserIntervention: false,
      now,
    })
    harness.teamRepository.updateRun(run.id, { status: "running", startedAt: now })

    const sent = await harness.service.executeTool(
      leader.mcpToken,
      "team_send_message",
      { target: "Worker", message: "Implement it" },
      7,
    )
    const retried = await harness.service.executeTool(
      leader.mcpToken,
      "team_send_message",
      { target: "Worker", message: "Duplicate payload" },
      7,
    )

    assert.deepEqual(retried, sent)
    assert.equal(harness.teamRepository.listRunIntents(run.id).length, 1)
  })
})

async function createHarness() {
  const workspace = await mkdtemp(join(tmpdir(), "agent-weave-tool-idempotency-"))
  temporaryDirectories.push(workspace)
  const database = new DatabaseSync(":memory:")
  const conversationRepository = new SqliteConversationRepository(database)
  const teamRepository = new SqliteTeamRepository(database)
  const conversations = new ConversationService(
    createGateway(),
    conversationRepository,
    new ConversationEventBus(conversationRepository),
  )
  const service = new TeamService(
    teamRepository,
    conversations,
    new TeamEventBus(teamRepository),
    new SqliteTeamToolCallRepository(database),
  )
  return { workspace, database, conversations, service, teamRepository }
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
