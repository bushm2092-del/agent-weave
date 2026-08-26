import {
  createAcpRuntime,
  createAgentRegistry,
  createRuntimeStore,
  type AcpRuntime,
  type AcpRuntimeUsageBreakdown,
} from "acpx/runtime"
import { environment } from "../../../config/index.js"
import {
  AgentGatewayError,
  type AgentGateway,
  type AgentMessageInput,
  type AgentMessageResult,
} from "./agent.gateway.js"

export class AcpxAgentGateway implements AgentGateway {
  constructor(
    private readonly runtime: AcpRuntime = createAcpRuntime({
      cwd: process.cwd(),
      sessionStore: createRuntimeStore({ stateDir: environment.acpxStateDir }),
      agentRegistry: createAgentRegistry(),
      permissionMode: "approve-reads",
      timeoutMs: environment.acpxTimeoutMs,
    }),
  ) {}

  async sendMessage(input: AgentMessageInput): Promise<AgentMessageResult> {
    const handle = await this.runtime.ensureSession({
      sessionKey: input.sessionKey,
      agent: input.agent,
      mode: "persistent",
      cwd: input.workspace,
      ...(input.model ? { sessionOptions: { model: input.model } } : {}),
    })
    const turn = this.runtime.startTurn({
      handle,
      text: input.message,
      mode: "prompt",
      requestId: input.requestId,
      timeoutMs: environment.acpxTimeoutMs,
      ...(input.signal ? { signal: input.signal } : {}),
    })

    let content = ""
    let usage: AcpRuntimeUsageBreakdown | undefined
    for await (const event of turn.events) {
      if (event.type === "text_delta" && event.stream !== "thought") {
        content += event.text
      }
      if (event.type === "status" && event.breakdown) {
        usage = event.breakdown
      }
    }

    const result = await turn.result
    if (result.status === "failed") {
      throw new AgentGatewayError(
        result.error.code ?? "AGENT_TURN_FAILED",
        result.error.message,
        result.error.retryable ?? false,
        result.error.detailCode,
      )
    }
    if (result.status === "cancelled") {
      throw new AgentGatewayError("AGENT_TURN_CANCELLED", "The agent turn was cancelled.")
    }
    if (!content.trim()) {
      throw new AgentGatewayError(
        "AGENT_EMPTY_RESPONSE",
        "The agent completed without returning a text response.",
      )
    }

    return {
      content,
      ...(result.stopReason ? { stopReason: result.stopReason } : {}),
      ...(usage ? { usage } : {}),
    }
  }
}

export const agentGateway: AgentGateway = new AcpxAgentGateway()
