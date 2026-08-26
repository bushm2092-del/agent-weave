import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type {
  AcpRuntime,
  AcpRuntimeEvent,
  AcpRuntimeHandle,
  AcpRuntimeTurnResult,
} from "acpx/runtime"
import { AcpxAgentGateway } from "../../src/features/conversations/gateways/acpx-agent.gateway.js"

function createRuntime(
  events: AcpRuntimeEvent[],
  result: AcpRuntimeTurnResult = { status: "completed", stopReason: "end_turn" },
): AcpRuntime {
  const handle: AcpRuntimeHandle = {
    sessionKey: "test-session",
    backend: "acpx",
    runtimeSessionName: "test-runtime-session",
  }

  return {
    async ensureSession() {
      return handle
    },
    startTurn(input) {
      return {
        requestId: input.requestId,
        promptStarted: Promise.resolve(),
        events: {
          async *[Symbol.asyncIterator]() {
            yield* events
          },
        },
        result: Promise.resolve(result),
        async cancel() {},
        async closeStream() {},
      }
    },
    async *runTurn() {
      yield* events
    },
    async cancel() {},
    async close() {},
  }
}

const input = {
  sessionKey: "test-session",
  requestId: "test-request",
  agent: "pi" as const,
  workspace: "/tmp",
  message: "Hello",
}

describe("AcpxAgentGateway", () => {
  it("collects output text while excluding thought text", async () => {
    const gateway = new AcpxAgentGateway(
      createRuntime([
        { type: "text_delta", text: "internal", stream: "thought" },
        { type: "text_delta", text: "Hello ", stream: "output" },
        { type: "text_delta", text: "world", stream: "output" },
      ]),
    )

    const result = await gateway.sendMessage(input)

    assert.equal(result.content, "Hello world")
    assert.equal(result.stopReason, "end_turn")
  })

  it("rejects a completed turn that contains no response text", async () => {
    const gateway = new AcpxAgentGateway(createRuntime([]))

    await assert.rejects(gateway.sendMessage(input), { code: "AGENT_EMPTY_RESPONSE" })
  })
})
