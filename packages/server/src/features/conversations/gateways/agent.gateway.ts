import type { AgentProvider, TokenUsage } from "@agent-weave/contracts"

export type AgentMessageInput = {
  sessionKey: string
  requestId: string
  agent: AgentProvider
  model?: string
  workspace: string
  message: string
  signal?: AbortSignal
}

export type AgentMessageResult = {
  content: string
  stopReason?: string
  usage?: TokenUsage
}

export interface AgentGateway {
  sendMessage(input: AgentMessageInput): Promise<AgentMessageResult>
}

export class AgentGatewayError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly detailCode?: string,
  ) {
    super(message)
    this.name = "AgentGatewayError"
  }
}
