import {
  agentConfigOptionSchema,
  conversationSchema,
  permissionOptionSchema,
  runSchema,
  tokenUsageSchema,
  type ConversationEvent,
} from "@agent-weave/contracts"
import type { Draft } from "immer"

import type {
  ConversationView,
  PendingPermission,
  ToolActivity,
} from "@/features/conversations/conversation-view.types"

export function applyConversationEvent(view: Draft<ConversationView>, event: ConversationEvent): void {
  if (event.sequence <= view.lastSequence) return
  view.lastSequence = event.sequence
  view.error = undefined

  if (event.type === "conversation.initializing" || event.type === "conversation.ready") {
    const conversation = conversationSchema.safeParse(event.data)
    if (conversation.success) view.conversation = conversation.data
    return
  }
  if (event.type === "conversation.failed") {
    const data = record(event.data)
    const conversation = conversationSchema.safeParse(data?.conversation)
    if (conversation.success) view.conversation = conversation.data
    view.error = typeof data?.error === "string" ? data.error : "The agent failed to initialize."
    return
  }
  if (event.type === "config.updated") {
    const data = record(event.data)
    const options = agentConfigOptionSchema.array().safeParse(data?.configOptions)
    if (options.success && view.conversation) view.conversation.configOptions = options.data
    return
  }
  if (
    event.type === "run.queued" ||
    event.type === "run.started" ||
    event.type === "run.completed" ||
    event.type === "run.failed" ||
    event.type === "run.cancelled"
  ) {
    const run = runSchema.safeParse(event.data)
    if (run.success) upsertRun(view, run.data)
    if (view.conversation) {
      view.conversation.status = event.type === "run.started" ? "running" : "ready"
    }
    return
  }
  if (!event.runId) return

  const run = view.runs.find((item) => item.id === event.runId)
  if (event.type === "assistant.delta" && run) {
    const text = record(event.data)?.text
    if (typeof text === "string") run.assistantText += text
    return
  }
  if (event.type === "thought.delta" && run) {
    const text = record(event.data)?.text
    if (typeof text === "string") run.thoughtText += text
    return
  }
  if (event.type === "usage.updated" && run) {
    const usage = tokenUsageSchema.safeParse(event.data)
    if (usage.success) run.usage = usage.data
    return
  }
  if (event.type === "tool.updated") {
    updateTool(view, event, event.runId)
    return
  }
  if (event.type === "permission.requested") {
    const permission = parsePermission(event)
    if (permission) view.pendingPermissions[permission.id] = permission
    return
  }
  if (event.type === "permission.resolved") {
    const permissionId = record(event.data)?.permissionId
    if (typeof permissionId === "string") delete view.pendingPermissions[permissionId]
  }
}

function upsertRun(view: Draft<ConversationView>, run: ConversationView["runs"][number]): void {
  const index = view.runs.findIndex((item) => item.id === run.id)
  if (index === -1) view.runs.push(run)
  else view.runs[index] = run
  view.runs.sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

function updateTool(view: Draft<ConversationView>, event: ConversationEvent, runId: string): void {
  const data = record(event.data)
  if (!data) return
  const id = typeof data.toolCallId === "string" ? data.toolCallId : event.id
  const tools = (view.toolsByRun[runId] ??= [])
  const next: ToolActivity = {
    id,
    runId,
    ...(typeof data.text === "string" ? { text: data.text } : {}),
    ...(typeof data.title === "string" ? { title: data.title } : {}),
    ...(typeof data.kind === "string" ? { kind: data.kind } : {}),
    ...(typeof data.status === "string" ? { status: data.status } : {}),
    ...(data.locations === undefined ? {} : { locations: data.locations }),
    ...(data.rawInput === undefined ? {} : { rawInput: data.rawInput }),
    ...(data.rawOutput === undefined ? {} : { rawOutput: data.rawOutput }),
  }
  const index = tools.findIndex((tool) => tool.id === id)
  if (index === -1) tools.push(next)
  else tools[index] = { ...tools[index], ...next }
}

function parsePermission(event: ConversationEvent & { runId?: string }): PendingPermission | undefined {
  if (!event.runId) return undefined
  const data = record(event.data)
  const options = permissionOptionSchema.array().safeParse(data?.options)
  if (typeof data?.permissionId !== "string" || !options.success) return undefined
  return {
    id: data.permissionId,
    runId: event.runId,
    toolCall: data.toolCall,
    options: options.data,
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined
}
