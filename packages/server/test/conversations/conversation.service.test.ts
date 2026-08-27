import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"
import { ConversationEventBus } from "../../src/features/conversations/conversation-event-bus.js"
import { ConversationService } from "../../src/features/conversations/conversation.service.js"
import type { AgentGateway } from "../../src/features/conversations/gateways/agent.gateway.js"
import { createMemoryConversationRepository } from "../../src/features/conversations/persistence/index.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

function createGateway(): AgentGateway {
  return {
    async initializeSession() {
      return {
        state: "created",
        configOptions: [
          {
            id: "model",
            name: "Model",
            category: "model",
            type: "select",
            currentValue: "model-a",
            options: [
              { value: "model-a", name: "Model A" },
              { value: "model-b", name: "Model B" },
            ],
          },
        ],
      }
    },
    async getConfigOptions() {
      return []
    },
    async setConfigOption() {
      return []
    },
    async run(input) {
      await input.emit({ type: "thought.delta", data: { text: "thinking" } })
      await input.emit({ type: "assistant.delta", data: { text: "Done" } })
      return { content: "Done", stopReason: "end_turn", configOptions: [] }
    },
    async decidePermission() {},
    async cancelRun() {},
    async closeSession() {},
  }
}

describe("ConversationService", () => {
  it("initializes a session and persists a streamed run", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "agent-weave-"))
    temporaryDirectories.push(workspace)
    const repository = createMemoryConversationRepository()
    const service = new ConversationService(createGateway(), repository, new ConversationEventBus(repository))

    const created = await service.create({ agent: "codex", workspace })
    await waitFor(() => service.get(created.id).status === "ready")
    const run = await service.createRun(created.id, { message: "Inspect", attachments: [] })
    await waitFor(() => service.listRuns(created.id)[0]?.status === "completed")

    const completed = service.listRuns(created.id)[0]
    assert.equal(completed?.id, run.id)
    assert.equal(completed?.assistantText, "Done")
    assert.equal(completed?.thoughtText, "thinking")
    assert.equal(service.get(created.id).sessionState, "created")
  })

  it("deletes conversation state when the window is closed", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "agent-weave-"))
    temporaryDirectories.push(workspace)
    const repository = createMemoryConversationRepository()
    const service = new ConversationService(createGateway(), repository, new ConversationEventBus(repository))
    const created = await service.create({ agent: "pi", workspace })
    await waitFor(() => service.get(created.id).status === "ready")

    await service.delete(created.id)

    assert.throws(() => service.get(created.id), { code: "CONVERSATION_NOT_FOUND" })
  })

  it("allows ACP configuration changes while a run is active", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "agent-weave-"))
    temporaryDirectories.push(workspace)
    let releaseRun: (() => void) | undefined
    const runGate = new Promise<void>((resolve) => {
      releaseRun = resolve
    })
    const gateway = createGateway()
    gateway.run = async () => {
      await runGate
      return { content: "Done", configOptions: [] }
    }
    gateway.setConfigOption = async () => [
      {
        id: "model",
        name: "Model",
        category: "model",
        type: "select",
        currentValue: "model-b",
        options: [
          { value: "model-a", name: "Model A" },
          { value: "model-b", name: "Model B" },
        ],
      },
    ]
    const repository = createMemoryConversationRepository()
    const service = new ConversationService(gateway, repository, new ConversationEventBus(repository))
    const created = await service.create({ agent: "codex", workspace })
    await waitFor(() => service.get(created.id).status === "ready")
    await service.createRun(created.id, { message: "Work", attachments: [] })
    await waitFor(() => service.get(created.id).status === "running")

    const updated = await service.setConfigOption(created.id, "model", {
      type: "select",
      value: "model-b",
    })

    assert.equal(updated.configOptions[0]?.currentValue, "model-b")
    releaseRun?.()
    await waitFor(() => service.listRuns(created.id)[0]?.status === "completed")
  })

  it("resolves pending permission requests when a run is cancelled", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "agent-weave-"))
    temporaryDirectories.push(workspace)
    let releaseRun: (() => void) | undefined
    const runGate = new Promise<void>((resolve) => {
      releaseRun = resolve
    })
    const gateway = createGateway()
    gateway.run = async (input) => {
      await input.emit({
        type: "permission.requested",
        data: {
          permissionId: "permission-one",
          toolCall: { name: "write_file" },
          options: [{ optionId: "allow_once", name: "Allow once", kind: "allow_once" }],
        },
      })
      await runGate
      return { content: "Late result", configOptions: [] }
    }
    const repository = createMemoryConversationRepository()
    const eventBus = new ConversationEventBus(repository)
    const events: string[] = []
    const service = new ConversationService(gateway, repository, eventBus)
    const created = await service.create({ agent: "codex", workspace })
    await waitFor(() => service.get(created.id).status === "ready")
    const unsubscribe = service.subscribe(created.id, (event) => events.push(event.type))
    const run = await service.createRun(created.id, { message: "Request access", attachments: [] })
    await waitFor(() => repository.getPermissionRequest("permission-one")?.status === "pending")

    const cancelled = await service.cancelRun(created.id, run.id)

    assert.equal(cancelled.status, "cancelled")
    assert.equal(repository.getPermissionRequest("permission-one")?.status, "cancelled")
    assert.ok(events.includes("permission.resolved"))
    unsubscribe()
    releaseRun?.()
  })

  it("cancels interrupted managed runs so the team queue can replay them once", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "agent-weave-"))
    temporaryDirectories.push(workspace)
    const repository = createMemoryConversationRepository()
    const eventBus = new ConversationEventBus(repository)
    const service = new ConversationService(createGateway(), repository, eventBus)
    const created = await service.createManaged({
      agent: "codex",
      workspace,
      owner: { kind: "team_member", id: "member-one" },
      sessionContext: {},
    })
    await waitFor(() => service.get(created.id).status === "ready")
    const queued = repository.createRun({
      id: crypto.randomUUID(),
      conversationId: created.id,
      message: "Queued work",
      attachments: [],
      now: new Date().toISOString(),
    })
    const running = repository.createRun({
      id: crypto.randomUUID(),
      conversationId: created.id,
      message: "Interrupted work",
      attachments: [],
      now: new Date().toISOString(),
    })
    repository.updateRun(running.id, { status: "running", startedAt: new Date().toISOString() })

    const restored = new ConversationService(createGateway(), repository, eventBus)
    await restored.restoreAll()

    assert.equal(repository.getRun(queued.id)?.status, "cancelled")
    assert.equal(repository.getRun(running.id)?.status, "cancelled")
    assert.equal(restored.get(created.id).status, "ready")
  })

  it("rejects public runs for a team-owned conversation", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "agent-weave-"))
    temporaryDirectories.push(workspace)
    const repository = createMemoryConversationRepository()
    const service = new ConversationService(createGateway(), repository, new ConversationEventBus(repository))
    const created = await service.createManaged({
      agent: "codex",
      workspace,
      owner: { kind: "team_member", id: "member-one" },
      sessionContext: {},
    })

    await assert.rejects(service.createRun(created.id, { message: "Bypass the team", attachments: [] }), {
      code: "MANAGED_CONVERSATION",
    })
    assert.equal(service.listRuns(created.id).length, 0)
  })

  it("rejects readiness waiters when a managed conversation is deleted during initialization", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "agent-weave-"))
    temporaryDirectories.push(workspace)
    let releaseInitialization: (() => void) | undefined
    const initializationGate = new Promise<void>((resolve) => {
      releaseInitialization = resolve
    })
    const gateway = createGateway()
    gateway.initializeSession = async () => {
      await initializationGate
      return { state: "created", configOptions: [] }
    }
    const repository = createMemoryConversationRepository()
    const service = new ConversationService(gateway, repository, new ConversationEventBus(repository))
    const created = await service.createManaged({
      agent: "codex",
      workspace,
      owner: { kind: "team_member", id: "member-one" },
      sessionContext: {},
    })
    const ready = service.waitUntilReady(created.id)

    await service.deleteManaged(created.id, "member-one")
    releaseInitialization?.()

    await assert.rejects(ready, { code: "CONVERSATION_DELETED" })
    assert.equal(repository.getConversation(created.id), undefined)
  })
})

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error("Condition was not reached")
}
