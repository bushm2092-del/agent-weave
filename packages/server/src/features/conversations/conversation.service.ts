import { randomUUID } from "node:crypto"
import { stat } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"
import type {
  AgentConfigOption,
  Conversation,
  ConversationEvent,
  CreateConversationRequest,
  CreateRunRequest,
  MessageAttachment,
  Run,
  SetConfigOptionRequest,
} from "@agent-weave/contracts"
import { ConversationError } from "./conversation.errors.js"
import { conversationEventBus, type ConversationEventBus } from "./conversation-event-bus.js"
import { createSessionKey, type ConversationServicePort } from "./conversation.models.js"
import {
  AgentGatewayError,
  agentGateway,
  type AgentGateway,
  type AgentRunEvent,
  type AgentSessionInput,
} from "./gateways/index.js"
import {
  conversationRepository,
  type ConversationRepository,
  type StoredConversation,
  type StoredRun,
} from "./persistence/index.js"

export class ConversationService implements ConversationServicePort {
  private readonly processingConversations = new Set<string>()
  private readonly activeRuns = new Map<string, { conversationId: string; controller: AbortController }>()

  constructor(
    private readonly gateway: AgentGateway,
    private readonly repository: ConversationRepository,
    private readonly eventBus: ConversationEventBus,
  ) {}

  async create(input: CreateConversationRequest): Promise<Conversation> {
    const workspace = resolve(input.workspace)
    await this.assertWorkspace(workspace)
    const id = randomUUID()
    const now = new Date().toISOString()
    const conversation = this.repository.createConversation({
      id,
      agent: input.agent,
      workspace,
      sessionKey: createSessionKey(id),
      now,
    })
    this.eventBus.publish({
      conversationId: id,
      type: "conversation.initializing",
      data: publicConversation(conversation),
    })
    void this.initialize(conversation)
    return publicConversation(conversation)
  }

  get(conversationId: string): Conversation {
    return publicConversation(this.requireConversation(conversationId))
  }

  listRuns(conversationId: string): Run[] {
    this.requireConversation(conversationId)
    return this.repository.listRuns(conversationId)
  }

  async createRun(conversationId: string, input: CreateRunRequest): Promise<Run> {
    const conversation = this.requireConversation(conversationId)
    await this.validateAttachments(conversation.workspace, input.attachments)
    const run = this.repository.createRun({
      id: randomUUID(),
      conversationId,
      message: input.message,
      attachments: input.attachments,
      now: new Date().toISOString(),
    })
    this.eventBus.publish({
      conversationId,
      runId: run.id,
      type: "run.queued",
      data: run,
    })
    if (conversation.status === "ready" || conversation.status === "running") {
      void this.drainQueue(conversationId)
    }
    return run
  }

  async setConfigOption(
    conversationId: string,
    configId: string,
    input: SetConfigOptionRequest,
  ): Promise<Conversation> {
    const conversation = this.requireConversation(conversationId)
    const option = conversation.configOptions.find((candidate) => candidate.id === configId)
    if (!option) {
      throw new ConversationError("CONFIG_OPTION_NOT_FOUND", "ACP config option not found.", 404)
    }
    assertConfigValue(option, input)
    const configOptions = await this.gateway.setConfigOption({
      ...sessionInput(conversation),
      configId,
      type: input.type,
      value: input.value,
    })
    const updated = this.repository.updateConversation(conversationId, {
      configOptions,
      error: null,
      updatedAt: new Date().toISOString(),
    })
    this.eventBus.publish({
      conversationId,
      type: "config.updated",
      data: { configOptions },
    })
    return publicConversation(updated)
  }

  async decidePermission(conversationId: string, runId: string, permissionId: string, optionId: string): Promise<void> {
    const permission = this.repository.getPermissionRequest(permissionId)
    if (!permission || permission.conversationId !== conversationId || permission.runId !== runId) {
      throw new ConversationError("PERMISSION_REQUEST_NOT_FOUND", "Permission request not found.", 404)
    }
    if (permission.status !== "pending") {
      throw new ConversationError("PERMISSION_ALREADY_RESOLVED", "Permission request is already resolved.", 409)
    }
    if (!permission.options.some((option) => option.optionId === optionId)) {
      throw new ConversationError("PERMISSION_OPTION_INVALID", "Permission option is invalid.", 400)
    }
    await this.gateway.decidePermission({ permissionId, optionId })
    const now = new Date().toISOString()
    this.repository.resolvePermissionRequest(permissionId, optionId, now)
    this.eventBus.publish({
      conversationId,
      runId,
      type: "permission.resolved",
      data: { permissionId, optionId, resolvedAt: now },
    })
  }

  async cancelRun(conversationId: string, runId: string): Promise<Run> {
    const run = this.requireRun(conversationId, runId)
    if (run.status === "queued") {
      const cancelled = this.repository.updateRun(runId, {
        status: "cancelled",
        completedAt: new Date().toISOString(),
      })
      this.eventBus.publish({ conversationId, runId, type: "run.cancelled", data: cancelled })
      return cancelled
    }
    if (run.status === "running") {
      this.activeRuns.get(runId)?.controller.abort("Cancelled by user")
      await this.gateway.cancelRun(runId)
    }
    return this.repository.getRun(runId) ?? run
  }

  async delete(conversationId: string): Promise<void> {
    const conversation = this.requireConversation(conversationId)
    const activeRun = [...this.activeRuns.entries()].find(([, value]) => value.conversationId === conversationId)
    if (activeRun) {
      activeRun[1].controller.abort("Conversation deleted")
      await this.gateway.cancelRun(activeRun[0])
    }
    try {
      await this.gateway.closeSession(sessionInput(conversation))
    } finally {
      this.eventBus.publish({
        conversationId,
        type: "conversation.deleted",
        data: { conversationId },
      })
      this.repository.deleteConversation(conversationId)
    }
  }

  eventsAfter(conversationId: string, sequence: number): ConversationEvent[] {
    this.requireConversation(conversationId)
    return this.repository.listEventsAfter(conversationId, sequence)
  }

  subscribe(conversationId: string, listener: (event: ConversationEvent) => void): () => void {
    this.requireConversation(conversationId)
    return this.eventBus.subscribe(conversationId, listener)
  }

  async restoreAll(): Promise<void> {
    await Promise.allSettled(
      this.repository.listRestorableConversations().map(async (conversation) => {
        for (const run of this.repository.listInterruptedRuns(conversation.id)) {
          this.repository.updateRun(run.id, { status: "queued", startedAt: null })
        }
        await this.initialize(conversation)
      }),
    )
  }

  private async initialize(conversation: StoredConversation): Promise<void> {
    try {
      const result = await this.gateway.initializeSession(sessionInput(conversation))
      const updated = this.repository.updateConversation(conversation.id, {
        status: "ready",
        sessionState: result.state,
        configOptions: result.configOptions,
        error: null,
        updatedAt: new Date().toISOString(),
      })
      this.eventBus.publish({
        conversationId: conversation.id,
        type: "conversation.ready",
        data: publicConversation(updated),
      })
      void this.drainQueue(conversation.id)
    } catch (error) {
      const message = errorMessage(error)
      const updated = this.repository.updateConversation(conversation.id, {
        status: "failed",
        error: message,
        updatedAt: new Date().toISOString(),
      })
      this.eventBus.publish({
        conversationId: conversation.id,
        type: "conversation.failed",
        data: { conversation: publicConversation(updated), error: message },
      })
    }
  }

  private async drainQueue(conversationId: string): Promise<void> {
    if (this.processingConversations.has(conversationId)) return
    this.processingConversations.add(conversationId)
    try {
      let run = this.repository.nextQueuedRun(conversationId)
      while (run) {
        const conversation = this.repository.getConversation(conversationId)
        if (!conversation || conversation.status === "failed" || conversation.status === "initializing") break
        await this.executeRun(conversation, run)
        run = this.repository.nextQueuedRun(conversationId)
      }
    } finally {
      this.processingConversations.delete(conversationId)
    }
  }

  private async executeRun(conversation: StoredConversation, run: StoredRun): Promise<void> {
    const startedAt = new Date().toISOString()
    const running = this.repository.updateRun(run.id, { status: "running", startedAt })
    this.repository.updateConversation(conversation.id, {
      status: "running",
      updatedAt: startedAt,
    })
    this.eventBus.publish({
      conversationId: conversation.id,
      runId: run.id,
      type: "run.started",
      data: running,
    })
    const controller = new AbortController()
    this.activeRuns.set(run.id, { conversationId: conversation.id, controller })

    try {
      const result = await this.gateway.run({
        ...sessionInput(conversation),
        conversationId: conversation.id,
        runId: run.id,
        message: run.message,
        attachments: run.attachments,
        signal: controller.signal,
        emit: (event) => this.handleRunEvent(conversation.id, run.id, event),
      })
      const completedAt = new Date().toISOString()
      const completed = this.repository.updateRun(run.id, {
        status: "completed",
        stopReason: result.stopReason ?? null,
        usage: result.usage ?? null,
        completedAt,
      })
      this.repository.updateConversation(conversation.id, {
        status: "ready",
        configOptions: result.configOptions,
        error: null,
        updatedAt: completedAt,
      })
      this.eventBus.publish({
        conversationId: conversation.id,
        runId: run.id,
        type: "run.completed",
        data: completed,
      })
    } catch (error) {
      const cancelled =
        controller.signal.aborted || (error instanceof AgentGatewayError && error.code === "AGENT_TURN_CANCELLED")
      const completedAt = new Date().toISOString()
      const failed = this.repository.updateRun(run.id, {
        status: cancelled ? "cancelled" : "failed",
        error: cancelled ? null : errorMessage(error),
        completedAt,
      })
      if (this.repository.getConversation(conversation.id)) {
        this.repository.updateConversation(conversation.id, {
          status: "ready",
          updatedAt: completedAt,
        })
        this.eventBus.publish({
          conversationId: conversation.id,
          runId: run.id,
          type: cancelled ? "run.cancelled" : "run.failed",
          data: failed,
        })
      }
    } finally {
      this.activeRuns.delete(run.id)
    }
  }

  private async handleRunEvent(conversationId: string, runId: string, event: AgentRunEvent): Promise<void> {
    if (event.type === "assistant.delta") {
      this.repository.appendAssistantText(runId, event.data.text)
    } else if (event.type === "thought.delta") {
      this.repository.appendThoughtText(runId, event.data.text)
    } else if (event.type === "permission.requested") {
      this.repository.createPermissionRequest({
        id: event.data.permissionId,
        conversationId,
        runId,
        options: event.data.options,
        status: "pending",
        createdAt: new Date().toISOString(),
      })
    }
    this.eventBus.publish({ conversationId, runId, type: event.type, data: event.data })
  }

  private requireConversation(conversationId: string): StoredConversation {
    const conversation = this.repository.getConversation(conversationId)
    if (!conversation) {
      throw new ConversationError("CONVERSATION_NOT_FOUND", "Conversation not found.", 404)
    }
    return conversation
  }

  private requireRun(conversationId: string, runId: string): StoredRun {
    const run = this.repository.getRun(runId)
    if (!run || run.conversationId !== conversationId) {
      throw new ConversationError("RUN_NOT_FOUND", "Run not found.", 404)
    }
    return run
  }

  private async assertWorkspace(workspace: string): Promise<void> {
    try {
      const workspaceStat = await stat(workspace)
      if (!workspaceStat.isDirectory()) {
        throw new ConversationError("WORKSPACE_NOT_DIRECTORY", "Workspace is not a directory.", 400)
      }
    } catch (error) {
      if (error instanceof ConversationError) throw error
      throw new ConversationError("WORKSPACE_NOT_FOUND", "Workspace does not exist.", 404)
    }
  }

  private async validateAttachments(workspace: string, attachments: MessageAttachment[]): Promise<void> {
    for (const attachment of attachments) {
      if (attachment.type !== "workspace_file") continue
      const path = resolve(workspace, attachment.path)
      const relativePath = relative(workspace, path)
      if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
        throw new ConversationError("ATTACHMENT_OUTSIDE_WORKSPACE", "Referenced file is outside the workspace.", 400)
      }
      try {
        const fileStat = await stat(path)
        if (!fileStat.isFile()) throw new Error("Not a file")
      } catch {
        throw new ConversationError("ATTACHMENT_NOT_FOUND", "Referenced workspace file does not exist.", 404)
      }
    }
  }
}

function sessionInput(conversation: StoredConversation): AgentSessionInput {
  return {
    sessionKey: conversation.sessionKey,
    agent: conversation.agent,
    workspace: conversation.workspace,
  }
}

function publicConversation(conversation: StoredConversation): Conversation {
  const { sessionKey: _sessionKey, ...publicValue } = conversation
  return publicValue
}

function assertConfigValue(option: AgentConfigOption, input: SetConfigOptionRequest): void {
  if (option.type !== input.type) {
    throw new ConversationError("CONFIG_OPTION_TYPE_INVALID", "ACP config option type does not match.", 400)
  }
  if (option.type === "select" && input.type === "select") {
    const values = option.options.flatMap((item) =>
      "value" in item ? [item.value] : item.options.map((child) => child.value),
    )
    if (!values.includes(input.value)) {
      throw new ConversationError("CONFIG_OPTION_VALUE_INVALID", "ACP config option value is invalid.", 400)
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export const conversationService = new ConversationService(agentGateway, conversationRepository, conversationEventBus)
