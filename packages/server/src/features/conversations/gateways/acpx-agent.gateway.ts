import { randomUUID } from "node:crypto"
import { rm } from "node:fs/promises"
import { join } from "node:path"
import {
  createAcpRuntime,
  createAgentRegistry,
  createRuntimeStore,
  type AcpPermissionDecision,
  type AcpPermissionRequest,
  type AcpRuntime,
  type AcpRuntimeHandle,
  type AcpRuntimeTurn,
  type AcpRuntimeUsageBreakdown,
  type AcpSessionStore,
} from "acpx/runtime"
import type { AgentConfigOption, MessageAttachment, PermissionOption } from "@agent-weave/contracts"
import { environment } from "../../../config/index.js"
import {
  AgentGatewayError,
  type AgentGateway,
  type AgentRunEvent,
  type AgentRunInput,
  type AgentRunResult,
  type AgentSessionInput,
  type AgentSessionResult,
} from "./agent.gateway.js"

type RunContext = {
  runId: string
  emit(event: AgentRunEvent): Promise<void>
}

type PendingPermission = {
  options: PermissionOption[]
  resolve(decision: AcpPermissionDecision): void
  reject(error: Error): void
  cleanup(): void
}

type RuntimeHandle = {
  runtime: AcpRuntime
  handle: AcpRuntimeHandle
}

export class AcpxAgentGateway implements AgentGateway {
  private readonly defaultRuntime: AcpRuntime
  private readonly sessionStore: AcpSessionStore
  private readonly handles = new Map<string, RuntimeHandle>()
  private readonly configuredRuntimes = new Map<string, AcpRuntime>()
  private readonly initializations = new Map<string, Promise<AgentSessionResult>>()
  private readonly runContexts = new Map<string, RunContext>()
  private readonly activeTurns = new Map<string, AcpRuntimeTurn>()
  private readonly pendingPermissions = new Map<string, PendingPermission>()

  constructor(runtime?: AcpRuntime, sessionStore?: AcpSessionStore) {
    this.sessionStore = sessionStore ?? createRuntimeStore({ stateDir: environment.acpxStateDir })
    this.defaultRuntime = runtime ?? this.createRuntime()
  }

  async initializeSession(input: AgentSessionInput): Promise<AgentSessionResult> {
    const activeInitialization = this.initializations.get(input.sessionKey)
    if (activeInitialization) return activeInitialization

    const initialization = this.doInitializeSession(input).finally(() => {
      this.initializations.delete(input.sessionKey)
    })
    this.initializations.set(input.sessionKey, initialization)
    return initialization
  }

  async getConfigOptions(input: AgentSessionInput): Promise<AgentConfigOption[]> {
    const { handle } = await this.ensureHandle(input)
    return this.readConfigOptions(handle)
  }

  async setConfigOption(
    input: AgentSessionInput & { configId: string; type: "select" | "boolean"; value: string | boolean },
  ): Promise<AgentConfigOption[]> {
    const { handle, runtime } = await this.ensureHandle(input)
    if (!runtime.setConfigOption) {
      throw new AgentGatewayError("CONFIG_UPDATE_UNSUPPORTED", "This Agent does not support configuration updates.")
    }
    if (input.type === "boolean") {
      throw new AgentGatewayError(
        "BOOLEAN_CONFIG_UNSUPPORTED",
        "The installed acpx runtime does not support boolean configuration updates.",
      )
    }
    if (typeof input.value !== "string") {
      throw new AgentGatewayError("CONFIG_OPTION_VALUE_INVALID", "Configuration value must be a string.")
    }
    await runtime.setConfigOption({ handle, key: input.configId, value: input.value })
    return this.readConfigOptions(handle)
  }

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const { handle, runtime } = await this.ensureHandle(input)
    const context: RunContext = { runId: input.runId, emit: input.emit }
    for (const sessionId of [handle.backendSessionId, handle.agentSessionId]) {
      if (sessionId) this.runContexts.set(sessionId, context)
    }

    const attachments = imageAttachments(input.attachments)
    const turn = runtime.startTurn({
      handle,
      text: withWorkspaceFileReferences(input.message, input.attachments),
      ...(attachments ? { attachments } : {}),
      mode: "prompt",
      requestId: input.runId,
      timeoutMs: environment.acpxTimeoutMs,
      ...(input.signal ? { signal: input.signal } : {}),
    })
    this.activeTurns.set(input.runId, turn)

    let content = ""
    let usage: AcpRuntimeUsageBreakdown | undefined
    try {
      for await (const event of turn.events) {
        if (event.type === "text_delta") {
          if (event.stream === "thought") {
            await input.emit({ type: "thought.delta", data: { text: event.text } })
          } else {
            content += event.text
            await input.emit({ type: "assistant.delta", data: { text: event.text } })
          }
        } else if (event.type === "tool_call") {
          await input.emit({
            type: "tool.updated",
            data: {
              text: event.text,
              ...(event.toolCallId ? { toolCallId: event.toolCallId } : {}),
              ...(event.status ? { status: event.status } : {}),
              ...(event.title ? { title: event.title } : {}),
              ...(event.kind ? { kind: event.kind } : {}),
              ...(event.locations ? { locations: event.locations } : {}),
              ...(event.rawInput === undefined ? {} : { rawInput: event.rawInput }),
              ...(event.rawOutput === undefined ? {} : { rawOutput: event.rawOutput }),
              ...(event.content ? { content: event.content } : {}),
            },
          })
        } else if (event.type === "status" && event.breakdown) {
          usage = event.breakdown
          await input.emit({ type: "usage.updated", data: event.breakdown })
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
        throw new AgentGatewayError("AGENT_EMPTY_RESPONSE", "The agent completed without returning a text response.")
      }

      return {
        content,
        ...(result.stopReason ? { stopReason: result.stopReason } : {}),
        ...(usage ? { usage } : {}),
        configOptions: await this.readConfigOptions(handle),
      }
    } finally {
      this.activeTurns.delete(input.runId)
      for (const sessionId of [handle.backendSessionId, handle.agentSessionId]) {
        if (sessionId && this.runContexts.get(sessionId)?.runId === input.runId) {
          this.runContexts.delete(sessionId)
        }
      }
    }
  }

  async decidePermission(input: { permissionId: string; optionId: string }): Promise<void> {
    const pending = this.pendingPermissions.get(input.permissionId)
    if (!pending) {
      throw new AgentGatewayError("PERMISSION_REQUEST_NOT_FOUND", "Permission request is no longer pending.")
    }
    const selected = pending.options.find((option) => option.optionId === input.optionId)
    if (!selected) {
      throw new AgentGatewayError("PERMISSION_OPTION_INVALID", "The selected permission option is invalid.")
    }
    pending.cleanup()
    pending.resolve({ outcome: selected.kind })
  }

  async cancelRun(runId: string): Promise<void> {
    await this.activeTurns.get(runId)?.cancel({ reason: "Cancelled by user" })
  }

  async closeSession(input: AgentSessionInput): Promise<void> {
    const { handle, runtime } = await this.ensureHandle(input)
    try {
      await runtime.close({ handle, reason: "Conversation deleted", discardPersistentState: true })
    } catch {
      // Some ACP agents do not implement session/close. Product deletion remains authoritative.
    } finally {
      this.handles.delete(input.sessionKey)
      this.configuredRuntimes.delete(input.sessionKey)
      await rm(join(environment.acpxStateDir, "sessions", `${encodeURIComponent(input.sessionKey)}.json`), {
        force: true,
      })
    }
  }

  private async doInitializeSession(input: AgentSessionInput): Promise<AgentSessionResult> {
    const existingRecord = await this.sessionStore.load(input.sessionKey)
    const runtime = this.runtimeFor(input)
    const sessionOptions = {
      ...(input.model ? { model: input.model } : {}),
      ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
    }
    const handle = await runtime.ensureSession({
      sessionKey: input.sessionKey,
      agent: input.agent,
      mode: "persistent",
      cwd: input.workspace,
      ...(Object.keys(sessionOptions).length > 0 ? { sessionOptions } : {}),
    })
    this.handles.set(input.sessionKey, { runtime, handle })
    return {
      state: existingRecord && !existingRecord.closed ? "resumed" : "created",
      configOptions: await this.readConfigOptions(handle),
    }
  }

  private async ensureHandle(input: AgentSessionInput): Promise<RuntimeHandle> {
    const cached = this.handles.get(input.sessionKey)
    if (cached) return cached
    await this.initializeSession(input)
    const entry = this.handles.get(input.sessionKey)
    if (!entry) throw new AgentGatewayError("ACP_SESSION_INIT_FAILED", "Agent session was not initialized.")
    return entry
  }

  private runtimeFor(input: AgentSessionInput): AcpRuntime {
    if (!input.mcpServers?.length) return this.defaultRuntime
    const existing = this.configuredRuntimes.get(input.sessionKey)
    if (existing) return existing
    const runtime = this.createRuntime(input.mcpServers)
    this.configuredRuntimes.set(input.sessionKey, runtime)
    return runtime
  }

  private createRuntime(mcpServers: AgentSessionInput["mcpServers"] = []): AcpRuntime {
    return createAcpRuntime({
      cwd: process.cwd(),
      sessionStore: this.sessionStore,
      agentRegistry: createAgentRegistry(),
      permissionMode: "deny-all",
      nonInteractivePermissions: "fail",
      timeoutMs: environment.acpxTimeoutMs,
      ...(mcpServers.length > 0
        ? {
            mcpServers: mcpServers.map((server) => ({
              type: "stdio" as const,
              name: server.name,
              command: server.command,
              args: server.args,
              env: Object.entries(server.env).map(([name, value]) => ({ name, value })),
            })),
          }
        : {}),
      onPermissionRequest: (request, context) => this.handlePermissionRequest(request, context.signal),
    })
  }

  private async readConfigOptions(handle: AcpRuntimeHandle): Promise<AgentConfigOption[]> {
    const record = await this.sessionStore.load(handle.acpxRecordId ?? handle.sessionKey)
    return normalizeConfigOptions(record?.acpx?.config_options)
  }

  private async handlePermissionRequest(
    request: AcpPermissionRequest,
    signal: AbortSignal,
  ): Promise<AcpPermissionDecision> {
    const context = this.runContexts.get(request.sessionId)
    if (!context) return { outcome: "cancel" }

    const permissionId = randomUUID()
    const options = request.raw.options.map((option) => ({
      optionId: option.optionId,
      name: option.name,
      kind: option.kind,
    }))

    return new Promise<AcpPermissionDecision>((resolve, reject) => {
      const cleanup = () => {
        signal.removeEventListener("abort", onAbort)
        this.pendingPermissions.delete(permissionId)
      }
      const onAbort = () => {
        cleanup()
        resolve({ outcome: "cancel" })
      }
      this.pendingPermissions.set(permissionId, { options, resolve, reject, cleanup })
      signal.addEventListener("abort", onAbort, { once: true })

      void context
        .emit({
          type: "permission.requested",
          data: { permissionId, toolCall: request.raw.toolCall, options },
        })
        .catch((error: unknown) => {
          cleanup()
          reject(error instanceof Error ? error : new Error(String(error)))
        })
    })
  }
}

type RawConfigOption = {
  id?: unknown
  name?: unknown
  description?: unknown
  category?: unknown
  type?: unknown
  currentValue?: unknown
  options?: unknown
}

function normalizeConfigOptions(options: unknown): AgentConfigOption[] {
  if (!Array.isArray(options)) return []
  return options.flatMap((raw): AgentConfigOption[] => {
    if (!raw || typeof raw !== "object") return []
    const option = raw as RawConfigOption
    if (typeof option.id !== "string" || typeof option.name !== "string") return []
    const shared = {
      id: option.id,
      name: option.name,
      ...(typeof option.description === "string" ? { description: option.description } : {}),
      ...(typeof option.category === "string" ? { category: option.category } : {}),
    }
    if (option.type === "boolean" && typeof option.currentValue === "boolean") {
      return [{ ...shared, type: "boolean", currentValue: option.currentValue }]
    }
    if (option.type === "select" && typeof option.currentValue === "string") {
      return [
        {
          ...shared,
          type: "select",
          currentValue: option.currentValue,
          options: normalizeSelectOptions(option.options),
        },
      ]
    }
    return []
  })
}

type SelectOptions = Extract<AgentConfigOption, { type: "select" }>["options"]

function normalizeSelectOptions(value: unknown): SelectOptions {
  if (!Array.isArray(value)) return []
  const groups = value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const candidate = item as Record<string, unknown>
    if (typeof candidate.group !== "string" || !Array.isArray(candidate.options)) return []
    return [{ group: candidate.group, options: normalizeFlatSelectOptions(candidate.options) }]
  })
  return groups.length === value.length ? groups : normalizeFlatSelectOptions(value)
}

function normalizeFlatSelectOptions(value: unknown[]): Array<{
  value: string
  name: string
  description?: string
}> {
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const candidate = item as Record<string, unknown>
    if (typeof candidate.value !== "string" || typeof candidate.name !== "string") return []
    return [
      {
        value: candidate.value,
        name: candidate.name,
        ...(typeof candidate.description === "string" ? { description: candidate.description } : {}),
      },
    ]
  })
}

function imageAttachments(attachments: MessageAttachment[]) {
  const images = attachments.filter((attachment) => attachment.type === "image")
  return images.length > 0 ? images.map((image) => ({ mediaType: image.mediaType, data: image.data })) : undefined
}

function withWorkspaceFileReferences(message: string, attachments: MessageAttachment[]): string {
  const paths = attachments
    .filter((attachment) => attachment.type === "workspace_file")
    .map((attachment) => attachment.path)
  return paths.length === 0
    ? message
    : `${message}\n\nReferenced workspace files:\n${paths.map((path) => `- ${path}`).join("\n")}`
}

export const agentGateway: AgentGateway = new AcpxAgentGateway()
