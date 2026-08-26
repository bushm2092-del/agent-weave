import type {
  Conversation,
  ConversationEvent,
  CreateConversationRequest,
  CreateRunRequest,
  Run,
  SetConfigOptionRequest,
} from "@agent-weave/contracts"

export type ConversationServicePort = {
  create(input: CreateConversationRequest): Promise<Conversation>
  get(conversationId: string): Conversation
  listRuns(conversationId: string): Run[]
  createRun(conversationId: string, input: CreateRunRequest): Promise<Run>
  setConfigOption(conversationId: string, configId: string, input: SetConfigOptionRequest): Promise<Conversation>
  decidePermission(conversationId: string, runId: string, permissionId: string, optionId: string): Promise<void>
  cancelRun(conversationId: string, runId: string): Promise<Run>
  delete(conversationId: string): Promise<void>
  eventsAfter(conversationId: string, sequence: number): ConversationEvent[]
  subscribe(conversationId: string, listener: (event: ConversationEvent) => void): () => void
}

export function createSessionKey(conversationId: string): string {
  return `agent-weave:conversation:${conversationId}`
}
