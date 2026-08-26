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
})

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  throw new Error("Condition was not reached")
}
