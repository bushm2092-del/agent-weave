import type { Conversation, PermissionOption, Run } from "@agent-weave/contracts"

export type ConversationConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting"

export type ToolActivity = {
  id: string
  runId: string
  text?: string
  title?: string
  kind?: string
  status?: string
  locations?: unknown
  rawInput?: unknown
  rawOutput?: unknown
}

export type PendingPermission = {
  id: string
  runId: string
  toolCall: unknown
  options: PermissionOption[]
}

export type ConversationView = {
  conversation?: Conversation
  runs: Run[]
  toolsByRun: Record<string, ToolActivity[]>
  pendingPermissions: Record<string, PendingPermission>
  lastSequence: number
  connectionStatus: ConversationConnectionStatus
  loading: boolean
  error?: string
}
