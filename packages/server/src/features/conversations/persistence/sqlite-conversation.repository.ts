import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"
import type {
  AgentConfigOption,
  Conversation,
  ConversationEvent,
  MessageAttachment,
  PermissionOption,
  Run,
  RunStatus,
  TokenUsage,
} from "@agent-weave/contracts"
import { environment } from "../../../config/index.js"
import { ConversationError } from "../conversation.errors.js"
import type {
  AppendEventInput,
  ConversationRepository,
  CreateConversationRecord,
  CreateRunRecord,
  StoredConversation,
  StoredPermissionRequest,
  StoredRun,
} from "./conversation.repository.js"

type SqliteRow = Record<string, unknown>

export class SqliteConversationRepository implements ConversationRepository {
  constructor(private readonly database: DatabaseSync = createDatabase(environment.databasePath)) {
    this.migrate()
  }

  createConversation(input: CreateConversationRecord): StoredConversation {
    this.database
      .prepare(
        `
      INSERT INTO conversations (
        id, agent, workspace, session_key, status, session_state,
        config_options, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'initializing', 'pending', '[]', ?, ?)
    `,
      )
      .run(input.id, input.agent, input.workspace, input.sessionKey, input.now, input.now)
    return this.requireConversation(input.id)
  }

  getConversation(id: string): StoredConversation | undefined {
    return mapConversation(this.database.prepare("SELECT * FROM conversations WHERE id = ?").get(id))
  }

  listRestorableConversations(): StoredConversation[] {
    return this.database.prepare("SELECT * FROM conversations ORDER BY created_at").all().map(mapConversation)
  }

  updateConversation(
    id: string,
    patch: {
      status?: Conversation["status"]
      sessionState?: Conversation["sessionState"]
      configOptions?: AgentConfigOption[]
      error?: string | null
      updatedAt: string
    },
  ): StoredConversation {
    const current = this.requireConversation(id)
    this.database
      .prepare(
        `
      UPDATE conversations
      SET status = ?, session_state = ?, config_options = ?, error = ?, updated_at = ?
      WHERE id = ?
    `,
      )
      .run(
        patch.status ?? current.status,
        patch.sessionState ?? current.sessionState,
        JSON.stringify(patch.configOptions ?? current.configOptions),
        patch.error === undefined ? (current.error ?? null) : patch.error,
        patch.updatedAt,
        id,
      )
    return this.requireConversation(id)
  }

  deleteConversation(id: string): void {
    this.database.prepare("DELETE FROM conversations WHERE id = ?").run(id)
  }

  createRun(input: CreateRunRecord): StoredRun {
    this.database
      .prepare(
        `
      INSERT INTO runs (
        id, conversation_id, status, message, attachments,
        assistant_text, thought_text, created_at
      ) VALUES (?, ?, 'queued', ?, ?, '', '', ?)
    `,
      )
      .run(input.id, input.conversationId, input.message, JSON.stringify(input.attachments), input.now)
    return this.requireRun(input.id)
  }

  getRun(id: string): StoredRun | undefined {
    return mapRun(this.database.prepare("SELECT * FROM runs WHERE id = ?").get(id))
  }

  nextQueuedRun(conversationId: string): StoredRun | undefined {
    return mapRun(
      this.database
        .prepare("SELECT * FROM runs WHERE conversation_id = ? AND status = 'queued' ORDER BY created_at LIMIT 1")
        .get(conversationId),
    )
  }

  listRuns(conversationId: string): StoredRun[] {
    return this.database
      .prepare("SELECT * FROM runs WHERE conversation_id = ? ORDER BY created_at")
      .all(conversationId)
      .map(mapRun)
  }

  listInterruptedRuns(conversationId: string): StoredRun[] {
    return this.database
      .prepare("SELECT * FROM runs WHERE conversation_id = ? AND status = 'running' ORDER BY created_at")
      .all(conversationId)
      .map(mapRun)
  }

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
  ): StoredRun {
    const current = this.requireRun(id)
    this.database
      .prepare(
        `
      UPDATE runs
      SET status = ?, error = ?, stop_reason = ?, usage = ?, started_at = ?, completed_at = ?
      WHERE id = ?
    `,
      )
      .run(
        patch.status ?? current.status,
        patch.error === undefined ? (current.error ?? null) : patch.error,
        patch.stopReason === undefined ? (current.stopReason ?? null) : patch.stopReason,
        patch.usage === undefined
          ? current.usage
            ? JSON.stringify(current.usage)
            : null
          : patch.usage
            ? JSON.stringify(patch.usage)
            : null,
        patch.startedAt === undefined ? (current.startedAt ?? null) : patch.startedAt,
        patch.completedAt === undefined ? (current.completedAt ?? null) : patch.completedAt,
        id,
      )
    return this.requireRun(id)
  }

  appendAssistantText(runId: string, delta: string): void {
    this.database.prepare("UPDATE runs SET assistant_text = assistant_text || ? WHERE id = ?").run(delta, runId)
  }

  appendThoughtText(runId: string, delta: string): void {
    this.database.prepare("UPDATE runs SET thought_text = thought_text || ? WHERE id = ?").run(delta, runId)
  }

  appendEvent(input: AppendEventInput): ConversationEvent {
    const result = this.database
      .prepare(
        `
      INSERT INTO conversation_events (id, conversation_id, run_id, type, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
      )
      .run(input.id, input.conversationId, input.runId ?? null, input.type, JSON.stringify(input.data), input.createdAt)
    return {
      sequence: Number(result.lastInsertRowid),
      id: input.id,
      conversationId: input.conversationId,
      ...(input.runId ? { runId: input.runId } : {}),
      type: input.type,
      data: input.data,
      createdAt: input.createdAt,
    }
  }

  listEventsAfter(conversationId: string, sequence: number): ConversationEvent[] {
    return this.database
      .prepare("SELECT * FROM conversation_events WHERE conversation_id = ? AND sequence > ? ORDER BY sequence")
      .all(conversationId, sequence)
      .map(mapEvent)
  }

  createPermissionRequest(request: StoredPermissionRequest): void {
    this.database
      .prepare(
        `
      INSERT INTO permission_requests (
        id, conversation_id, run_id, options, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        request.id,
        request.conversationId,
        request.runId,
        JSON.stringify(request.options),
        request.status,
        request.createdAt,
      )
  }

  getPermissionRequest(id: string): StoredPermissionRequest | undefined {
    return mapPermission(this.database.prepare("SELECT * FROM permission_requests WHERE id = ?").get(id))
  }

  resolvePermissionRequest(id: string, optionId: string, now: string): void {
    this.database
      .prepare(
        `
      UPDATE permission_requests
      SET status = 'resolved', selected_option_id = ?, resolved_at = ?
      WHERE id = ? AND status = 'pending'
    `,
      )
      .run(optionId, now, id)
  }

  private requireConversation(id: string): StoredConversation {
    const conversation = this.getConversation(id)
    if (!conversation) {
      throw new ConversationError("CONVERSATION_NOT_FOUND", "Conversation not found.", 404)
    }
    return conversation
  }

  private requireRun(id: string): StoredRun {
    const run = this.getRun(id)
    if (!run) {
      throw new ConversationError("RUN_NOT_FOUND", "Run not found.", 404)
    }
    return run
  }

  private migrate(): void {
    this.database.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        workspace TEXT NOT NULL,
        session_key TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        session_state TEXT NOT NULL,
        config_options TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        attachments TEXT NOT NULL,
        assistant_text TEXT NOT NULL,
        thought_text TEXT NOT NULL,
        error TEXT,
        stop_reason TEXT,
        usage TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS conversation_events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS permission_requests (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        options TEXT NOT NULL,
        status TEXT NOT NULL,
        selected_option_id TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_runs_conversation_status
        ON runs(conversation_id, status, created_at);
      CREATE INDEX IF NOT EXISTS idx_events_conversation_sequence
        ON conversation_events(conversation_id, sequence);
    `)
  }
}

function createDatabase(path: string): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true })
  return new DatabaseSync(path)
}

function mapConversation(row: SqliteRow | undefined): StoredConversation | undefined
function mapConversation(row: SqliteRow): StoredConversation
function mapConversation(row: SqliteRow | undefined): StoredConversation | undefined {
  if (!row) return undefined
  return {
    id: String(row.id),
    agent: String(row.agent) as StoredConversation["agent"],
    workspace: String(row.workspace),
    sessionKey: String(row.session_key),
    status: String(row.status) as StoredConversation["status"],
    sessionState: String(row.session_state) as StoredConversation["sessionState"],
    configOptions: parseJson<AgentConfigOption[]>(row.config_options, []),
    ...(row.error ? { error: String(row.error) } : {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapRun(row: SqliteRow | undefined): StoredRun | undefined
function mapRun(row: SqliteRow): StoredRun
function mapRun(row: SqliteRow | undefined): StoredRun | undefined {
  if (!row) return undefined
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    status: String(row.status) as Run["status"],
    message: String(row.message),
    attachments: parseJson<MessageAttachment[]>(row.attachments, []),
    assistantText: String(row.assistant_text),
    thoughtText: String(row.thought_text),
    ...(row.error ? { error: String(row.error) } : {}),
    ...(row.stop_reason ? { stopReason: String(row.stop_reason) } : {}),
    ...(row.usage ? { usage: parseJson<TokenUsage>(row.usage, {}) } : {}),
    createdAt: String(row.created_at),
    ...(row.started_at ? { startedAt: String(row.started_at) } : {}),
    ...(row.completed_at ? { completedAt: String(row.completed_at) } : {}),
  }
}

function mapEvent(row: SqliteRow): ConversationEvent {
  return {
    sequence: Number(row.sequence),
    id: String(row.id),
    conversationId: String(row.conversation_id),
    ...(row.run_id ? { runId: String(row.run_id) } : {}),
    type: String(row.type) as ConversationEvent["type"],
    data: parseJson(row.data, null),
    createdAt: String(row.created_at),
  }
}

function mapPermission(row: SqliteRow | undefined): StoredPermissionRequest | undefined {
  if (!row) return undefined
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    runId: String(row.run_id),
    options: parseJson<PermissionOption[]>(row.options, []),
    status: String(row.status) as StoredPermissionRequest["status"],
    ...(row.selected_option_id ? { selectedOptionId: String(row.selected_option_id) } : {}),
    createdAt: String(row.created_at),
    ...(row.resolved_at ? { resolvedAt: String(row.resolved_at) } : {}),
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function createMemoryConversationRepository(): SqliteConversationRepository {
  return new SqliteConversationRepository(new DatabaseSync(":memory:"))
}

export const conversationRepository: ConversationRepository = new SqliteConversationRepository()
