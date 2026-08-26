import type {
  AgentConfigOption,
  AgentProvider,
  Conversation,
  ConversationEvent,
  ConversationEventType,
  MessageAttachment,
  PermissionOption,
  Run,
  RunStatus,
  TokenUsage,
} from "@agent-weave/contracts"

export type StoredConversation = Conversation & { sessionKey: string }

export type StoredRun = Run

export type StoredPermissionRequest = {
  id: string
  conversationId: string
  runId: string
  options: PermissionOption[]
  status: "pending" | "resolved" | "cancelled"
  selectedOptionId?: string
  createdAt: string
  resolvedAt?: string
}

export type CreateConversationRecord = {
  id: string
  agent: AgentProvider
  workspace: string
  sessionKey: string
  now: string
}

export type CreateRunRecord = {
  id: string
  conversationId: string
  message: string
  attachments: MessageAttachment[]
  now: string
}

export type AppendEventInput = {
  id: string
  conversationId: string
  runId?: string
  type: ConversationEventType
  data: unknown
  createdAt: string
}

export interface ConversationRepository {
  createConversation(input: CreateConversationRecord): StoredConversation
  getConversation(id: string): StoredConversation | undefined
  listRestorableConversations(): StoredConversation[]
  updateConversation(
    id: string,
    patch: {
      status?: Conversation["status"]
      sessionState?: Conversation["sessionState"]
      configOptions?: AgentConfigOption[]
      error?: string | null
      updatedAt: string
    },
  ): StoredConversation
  deleteConversation(id: string): void
  createRun(input: CreateRunRecord): StoredRun
  getRun(id: string): StoredRun | undefined
  nextQueuedRun(conversationId: string): StoredRun | undefined
  listRuns(conversationId: string): StoredRun[]
  listInterruptedRuns(conversationId: string): StoredRun[]
  updateRun(
    id: string,
    patch: {
      status?: RunStatus
      error?: string | null
      stopReason?: string | null
      usage?: TokenUsage | null
      startedAt?: string | null
      completedAt?: string | null
    },
  ): StoredRun
  appendAssistantText(runId: string, delta: string): void
  appendThoughtText(runId: string, delta: string): void
  appendEvent(input: AppendEventInput): ConversationEvent
  listEventsAfter(conversationId: string, sequence: number): ConversationEvent[]
  createPermissionRequest(request: StoredPermissionRequest): void
  getPermissionRequest(id: string): StoredPermissionRequest | undefined
  resolvePermissionRequest(id: string, optionId: string, now: string): void
}
