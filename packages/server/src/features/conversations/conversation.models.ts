import type {
  AgentProvider,
  CreateConversationRequest,
  CreateConversationResponse,
} from "@agent-weave/contracts"

export type SendConversationInput = CreateConversationRequest & {
  signal?: AbortSignal
}

export type ConversationServicePort = {
  send(input: SendConversationInput): Promise<CreateConversationResponse>
}

export function createSessionKey(conversationId: string, agent: AgentProvider): string {
  return `agent-weave:${agent}:${conversationId}`
}
