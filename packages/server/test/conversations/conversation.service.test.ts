import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"
import { ConversationService } from "../../src/features/conversations/conversation.service.js"
import type {
  AgentGateway,
  AgentMessageInput,
} from "../../src/features/conversations/gateways/agent.gateway.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe("ConversationService", () => {
  it("creates a conversation and delegates the prompt to the gateway", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "agent-weave-"))
    temporaryDirectories.push(workspace)
    let received: AgentMessageInput | undefined
    const gateway: AgentGateway = {
      async sendMessage(input) {
        received = input
        return { content: "Done", stopReason: "end_turn", usage: { totalTokens: 42 } }
      },
    }
    const service = new ConversationService(gateway)

    const result = await service.send({
      agent: "codex",
      model: "gpt-5.2-codex",
      workspace,
      message: "Inspect this workspace",
    })

    assert.equal(received?.agent, "codex")
    assert.equal(received?.workspace, workspace)
    assert.match(received?.sessionKey ?? "", /^agent-weave:codex:/)
    assert.equal(result.content, "Done")
    assert.equal(result.usage?.totalTokens, 42)
  })

  it("rejects a missing workspace before calling the gateway", async () => {
    const gateway: AgentGateway = {
      async sendMessage() {
        throw new Error("Gateway should not be called")
      },
    }
    const service = new ConversationService(gateway)

    await assert.rejects(
      service.send({ agent: "pi", workspace: join(tmpdir(), randomMissingPath()), message: "Hello" }),
      { code: "WORKSPACE_NOT_FOUND" },
    )
  })
})

function randomMissingPath(): string {
  return `agent-weave-missing-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
