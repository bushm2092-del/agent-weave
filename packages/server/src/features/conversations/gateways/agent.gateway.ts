import type {
  AgentConfigOption,
  AgentProvider,
  MessageAttachment,
  PermissionOption,
  TokenUsage,
} from "@agent-weave/contracts"

export type AgentSessionInput = {
  sessionKey: string
  agent: AgentProvider
  workspace: string
}

export type AgentSessionResult = {
  state: "created" | "resumed"
  configOptions: AgentConfigOption[]
}

export type AgentRunEvent =
  | { type: "assistant.delta"; data: { text: string } }
  | { type: "thought.delta"; data: { text: string } }
  | { type: "tool.updated"; data: Record<string, unknown> }
  | { type: "usage.updated"; data: TokenUsage }
  | {
      type: "permission.requested"
      data: { permissionId: string; toolCall: unknown; options: PermissionOption[] }
    }

export type AgentRunInput = AgentSessionInput & {
  conversationId: string
  runId: string
  message: string
  attachments: MessageAttachment[]
  signal?: AbortSignal
  emit(event: AgentRunEvent): Promise<void>
}

export type AgentRunResult = {
  content: string
  stopReason?: string
  usage?: TokenUsage
  configOptions: AgentConfigOption[]
}

export interface AgentGateway {
  initializeSession(input: AgentSessionInput): Promise<AgentSessionResult>
  getConfigOptions(input: AgentSessionInput): Promise<AgentConfigOption[]>
  setConfigOption(
    input: AgentSessionInput & { configId: string; type: "select" | "boolean"; value: string | boolean },
  ): Promise<AgentConfigOption[]>
  run(input: AgentRunInput): Promise<AgentRunResult>
  decidePermission(input: { permissionId: string; optionId: string }): Promise<void>
  cancelRun(runId: string): Promise<void>
  closeSession(input: AgentSessionInput): Promise<void>
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
