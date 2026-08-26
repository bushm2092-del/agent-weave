import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { AcpRuntime, AcpRuntimeEvent, AcpRuntimeHandle, AcpRuntimeTurnResult, AcpSessionStore } from "acpx/runtime"
import { AcpxAgentGateway } from "../../src/features/conversations/gateways/acpx-agent.gateway.js"

function createRuntime(
  events: AcpRuntimeEvent[],
  result: AcpRuntimeTurnResult = { status: "completed", stopReason: "end_turn" },
): AcpRuntime {
  const handle: AcpRuntimeHandle = {
    sessionKey: "test-session",
    backend: "acpx",
    runtimeSessionName: "test-runtime-session",
    backendSessionId: "backend-session",
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

function createStore(): AcpSessionStore {
  return {
    async load() {
      return undefined
    },
    async save() {},
  }
}

const session = {
  sessionKey: "test-session",
  agent: "pi" as const,
  workspace: "/tmp",
}

describe("AcpxAgentGateway", () => {
  it("streams output and thought events separately", async () => {
    const gateway = new AcpxAgentGateway(
      createRuntime([
        { type: "text_delta", text: "internal", stream: "thought" },
        { type: "text_delta", text: "Hello ", stream: "output" },
        { type: "text_delta", text: "world", stream: "output" },
      ]),
      createStore(),
    )
    const received: string[] = []

    const result = await gateway.run({
      ...session,
      conversationId: "conversation",
      runId: "run",
      message: "Hello",
      attachments: [],
      async emit(event) {
        received.push(event.type)
      },
    })

    assert.equal(result.content, "Hello world")
    assert.deepEqual(received, ["thought.delta", "assistant.delta", "assistant.delta"])
  })

  it("rejects a completed turn with no response text", async () => {
    const gateway = new AcpxAgentGateway(createRuntime([]), createStore())
    await assert.rejects(
      gateway.run({
        ...session,
        conversationId: "conversation",
        runId: "run",
        message: "Hello",
        attachments: [],
        async emit() {},
      }),
      { code: "AGENT_EMPTY_RESPONSE" },
    )
  })

  it("deletes local session state when the Agent does not support session close", async () => {
    const runtime = createRuntime([])
    runtime.close = async () => {
      throw new Error("session/close unsupported")
    }
    const gateway = new AcpxAgentGateway(runtime, createStore())

    await gateway.closeSession(session)
  })
})
