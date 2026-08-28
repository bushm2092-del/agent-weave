import { DatabaseSync } from "node:sqlite"
import type { Team, TeamEvent, TeamMember, TeamRun, TeamSpawnRequest, TeamTask } from "@agent-weave/contracts"
import { appDatabase } from "../../../database/index.js"
import { TeamError } from "../team.errors.js"
import type {
  AppendTeamEventInput,
  CreateTeamMemberRecord,
  CreateTeamMessageRecord,
  CreateTeamRecord,
  CreateTeamRunRecord,
  CreateTeamSpawnRequestRecord,
  CreateTeamTaskRecord,
  CreateWorkIntentRecord,
  StoredTeam,
  StoredTeamMember,
  StoredTeamMessage,
  StoredTeamRun,
  StoredWorkIntent,
  TeamRepository,
} from "../team.models.js"

type SqliteRow = Record<string, unknown>
let nextSavepointId = 0

export class SqliteTeamRepository implements TeamRepository {
  constructor(private readonly database: DatabaseSync = appDatabase) {
    this.migrate()
  }

  transaction<T>(action: () => T): T {
    if (this.database.isTransaction) {
      const savepoint = `team_repository_${++nextSavepointId}`
      this.database.exec(`SAVEPOINT ${savepoint}`)
      try {
        const result = action()
        this.database.exec(`RELEASE SAVEPOINT ${savepoint}`)
        return result
      } catch (error) {
        this.database.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`)
        this.database.exec(`RELEASE SAVEPOINT ${savepoint}`)
        throw error
      }
    }
    this.database.exec("BEGIN IMMEDIATE")
    try {
      const result = action()
      this.database.exec("COMMIT")
      return result
    } catch (error) {
      this.database.exec("ROLLBACK")
      throw error
    }
  }

  createTeam(input: CreateTeamRecord): StoredTeam {
    this.database
      .prepare(
        `INSERT INTO teams (
          id, canvas_id, name, workspace, leader_slot_id, session_status, lifecycle_status,
          control_token_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.canvasId,
        input.name,
        input.workspace,
        input.leaderSlotId,
        input.sessionStatus,
        input.lifecycleStatus,
        input.controlTokenHash ?? "",
        input.now,
        input.now,
      )
    return this.requireTeam(input.id)
  }

  getTeam(id: string): StoredTeam | undefined {
    return mapTeam(this.database.prepare("SELECT * FROM teams WHERE id = ?").get(id))
  }

  getSnapshot(id: string): Team | undefined {
    const team = this.getTeam(id)
    if (!team) return undefined
    const activeRun = this.findActiveRun(id)
    return {
      id: team.id,
      canvasId: team.canvasId,
      name: team.name,
      workspace: team.workspace,
      leaderSlotId: team.leaderSlotId,
      sessionStatus: team.sessionStatus,
      ...(team.error ? { error: team.error } : {}),
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      members: this.listMembers(id).map(publicMember),
      tasks: this.listTasks(id),
      spawnRequests: this.listSpawnRequests(id),
      ...(activeRun ? { activeRun } : {}),
    }
  }

  listSnapshots(canvasId?: string, includeInactive = false): Team[] {
    const lifecycleClause = includeInactive ? "" : " AND lifecycle_status = 'active'"
    const rows = canvasId
      ? this.database
          .prepare(`SELECT id FROM teams WHERE canvas_id = ?${lifecycleClause} ORDER BY created_at`)
          .all(canvasId)
      : this.database.prepare(`SELECT id FROM teams WHERE 1 = 1${lifecycleClause} ORDER BY created_at`).all()
    return rows.flatMap((row) => {
      const team = this.getSnapshot(String((row as SqliteRow).id))
      return team ? [team] : []
    })
  }

  updateTeam(
    id: string,
    patch: {
      name?: string
      sessionStatus?: StoredTeam["sessionStatus"]
      lifecycleStatus?: StoredTeam["lifecycleStatus"]
      error?: string | null
      updatedAt: string
    },
  ): StoredTeam {
    const current = this.requireTeam(id)
    this.database
      .prepare(
        "UPDATE teams SET name = ?, session_status = ?, lifecycle_status = ?, error = ?, updated_at = ? WHERE id = ?",
      )
      .run(
        patch.name ?? current.name,
        patch.sessionStatus ?? current.sessionStatus,
        patch.lifecycleStatus ?? current.lifecycleStatus,
        patch.error === undefined ? (current.error ?? null) : patch.error,
        patch.updatedAt,
        id,
      )
    return this.requireTeam(id)
  }

  deleteTeam(id: string): void {
    this.database.prepare("DELETE FROM teams WHERE id = ?").run(id)
  }

  createMember(input: CreateTeamMemberRecord): StoredTeamMember {
    try {
      this.database
        .prepare(
          `INSERT INTO team_members (
            slot_id, team_id, conversation_id, name, normalized_name, role, agent, model, role_preset_id, role_prompt, mcp_token,
            runtime_status, work_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.slotId,
          input.teamId,
          input.conversationId,
          input.name,
          normalizeName(input.name),
          input.role,
          input.agent,
          input.model ?? null,
          input.rolePresetId ?? null,
          input.rolePrompt ?? null,
          input.mcpToken,
          input.runtimeStatus,
          input.workStatus,
          input.now,
          input.now,
        )
    } catch (error) {
      if (error instanceof Error && error.message.includes("TEAM_MEMBER_LIMIT")) {
        throw new TeamError("TEAM_MEMBER_LIMIT", "A team can have at most 8 members.", 409)
      }
      throw error
    }
    return this.requireMember(input.slotId)
  }

  getMember(teamId: string, slotId: string): StoredTeamMember | undefined {
    return mapMember(
      this.database.prepare("SELECT * FROM team_members WHERE team_id = ? AND slot_id = ?").get(teamId, slotId),
    )
  }

  getMemberByToken(token: string): StoredTeamMember | undefined {
    return mapMember(this.database.prepare("SELECT * FROM team_members WHERE mcp_token = ?").get(token))
  }

  findMember(teamId: string, identifier: string): StoredTeamMember | undefined {
    return mapMember(
      this.database
        .prepare("SELECT * FROM team_members WHERE team_id = ? AND (slot_id = ? OR normalized_name = ?)")
        .get(teamId, identifier, normalizeName(identifier)),
    )
  }

  listMembers(teamId: string): StoredTeamMember[] {
    return this.database
      .prepare("SELECT * FROM team_members WHERE team_id = ? ORDER BY role, created_at")
      .all(teamId)
      .map(mapMember)
  }

  updateMember(
    slotId: string,
    patch: {
      name?: string
      runtimeStatus?: StoredTeamMember["runtimeStatus"]
      workStatus?: StoredTeamMember["workStatus"]
      error?: string | null
      updatedAt: string
    },
  ): StoredTeamMember {
    const current = this.requireMember(slotId)
    const name = patch.name ?? current.name
    this.database
      .prepare(
        `UPDATE team_members SET
          name = ?, normalized_name = ?, runtime_status = ?, work_status = ?, error = ?, updated_at = ?
        WHERE slot_id = ?`,
      )
      .run(
        name,
        normalizeName(name),
        patch.runtimeStatus ?? current.runtimeStatus,
        patch.workStatus ?? current.workStatus,
        patch.error === undefined ? (current.error ?? null) : patch.error,
        patch.updatedAt,
        slotId,
      )
    return this.requireMember(slotId)
  }

  deleteMember(slotId: string, now: string): void {
    this.database
      .prepare("UPDATE team_tasks SET owner_slot_id = NULL, updated_at = ? WHERE owner_slot_id = ?")
      .run(now, slotId)
    this.database.prepare("DELETE FROM team_members WHERE slot_id = ?").run(slotId)
  }

  createRun(input: CreateTeamRunRecord): StoredTeamRun {
    this.database
      .prepare(
        `INSERT INTO team_runs (
          id, team_id, target_slot_id, status, source, has_user_intervention, created_at
        ) VALUES (?, ?, ?, 'accepted', ?, ?, ?)`,
      )
      .run(input.id, input.teamId, input.targetSlotId, input.source, Number(input.hasUserIntervention), input.now)
    return this.requireRun(input.id)
  }

  getRun(teamId: string, runId: string): StoredTeamRun | undefined {
    return mapRun(this.database.prepare("SELECT * FROM team_runs WHERE team_id = ? AND id = ?").get(teamId, runId))
  }

  findActiveRun(teamId: string): StoredTeamRun | undefined {
    return mapRun(
      this.database
        .prepare(
          `SELECT * FROM team_runs
           WHERE team_id = ? AND status IN ('accepted', 'running', 'cancelling')
           ORDER BY created_at DESC LIMIT 1`,
        )
        .get(teamId),
    )
  }

  listRuns(teamId: string): StoredTeamRun[] {
    return this.database
      .prepare("SELECT * FROM team_runs WHERE team_id = ? ORDER BY created_at")
      .all(teamId)
      .map(mapRun)
  }

  updateRun(
    runId: string,
    patch: {
      status?: StoredTeamRun["status"]
      hasUserIntervention?: boolean
      error?: string | null
      startedAt?: string | null
      completedAt?: string | null
    },
  ): StoredTeamRun {
    const current = this.requireRun(runId)
    this.database
      .prepare(
        `UPDATE team_runs SET
          status = ?, has_user_intervention = ?, error = ?, started_at = ?, completed_at = ?
        WHERE id = ?`,
      )
      .run(
        patch.status ?? current.status,
        Number(patch.hasUserIntervention ?? current.hasUserIntervention),
        patch.error === undefined ? (current.error ?? null) : patch.error,
        patch.startedAt === undefined ? (current.startedAt ?? null) : patch.startedAt,
        patch.completedAt === undefined ? (current.completedAt ?? null) : patch.completedAt,
        runId,
      )
    return this.requireRun(runId)
  }

  createMessage(input: CreateTeamMessageRecord): StoredTeamMessage {
    this.database
      .prepare(
        `INSERT INTO team_mailbox (
          id, team_id, team_run_id, from_slot_id, to_slot_id, source, content, attachments,
          status, client_message_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`,
      )
      .run(
        input.id,
        input.teamId,
        input.teamRunId,
        input.fromSlotId ?? null,
        input.toSlotId,
        input.source,
        input.content,
        JSON.stringify(input.attachments),
        input.clientMessageId ?? null,
        input.now,
      )
    return this.requireMessage(input.id)
  }

  getMessage(id: string): StoredTeamMessage | undefined {
    return mapMessage(this.database.prepare("SELECT * FROM team_mailbox WHERE id = ?").get(id))
  }

  findMessageByClientId(teamId: string, clientMessageId: string): StoredTeamMessage | undefined {
    return mapMessage(
      this.database
        .prepare("SELECT * FROM team_mailbox WHERE team_id = ? AND client_message_id = ?")
        .get(teamId, clientMessageId),
    )
  }

  updateMessageStatus(id: string, status: StoredTeamMessage["status"], now: string): void {
    this.database
      .prepare("UPDATE team_mailbox SET status = ?, delivered_at = ? WHERE id = ?")
      .run(status, status === "delivered" ? now : null, id)
  }

  createIntent(input: CreateWorkIntentRecord): StoredWorkIntent {
    this.database
      .prepare(
        `INSERT INTO team_work_intents (
          id, team_id, team_run_id, slot_id, message_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'queued', ?)`,
      )
      .run(input.id, input.teamId, input.teamRunId, input.slotId, input.messageId, input.now)
    return this.requireIntent(input.id)
  }

  getIntent(id: string): StoredWorkIntent | undefined {
    return mapIntent(this.database.prepare("SELECT * FROM team_work_intents WHERE id = ?").get(id))
  }

  nextQueuedIntent(teamId: string, slotId: string): StoredWorkIntent | undefined {
    return mapIntent(
      this.database
        .prepare(
          `SELECT * FROM team_work_intents
           WHERE team_id = ? AND slot_id = ? AND status = 'queued'
           ORDER BY created_at LIMIT 1`,
        )
        .get(teamId, slotId),
    )
  }

  claimNextQueuedIntent(teamId: string, slotId: string, startedAt: string): StoredWorkIntent | undefined {
    return mapIntent(
      this.database
        .prepare(
          `UPDATE team_work_intents
           SET status = 'running', conversation_run_id = NULL, error = NULL,
               started_at = ?, completed_at = NULL
           WHERE id = (
             SELECT id FROM team_work_intents
             WHERE team_id = ? AND slot_id = ? AND status = 'queued'
             ORDER BY created_at, id LIMIT 1
           )
           AND status = 'queued'
           AND NOT EXISTS (
             SELECT 1 FROM team_work_intents
             WHERE team_id = ? AND slot_id = ? AND status = 'running'
           )
           RETURNING *`,
        )
        .get(startedAt, teamId, slotId, teamId, slotId),
    )
  }

  findRunningIntent(teamId: string, slotId: string): StoredWorkIntent | undefined {
    return mapIntent(
      this.database
        .prepare(
          `SELECT * FROM team_work_intents
           WHERE team_id = ? AND slot_id = ? AND status = 'running'
           ORDER BY created_at DESC LIMIT 1`,
        )
        .get(teamId, slotId),
    )
  }

  listActiveMemberIntents(teamId: string, slotId: string): StoredWorkIntent[] {
    return this.database
      .prepare(
        `SELECT * FROM team_work_intents
         WHERE team_id = ? AND slot_id = ? AND status IN ('queued', 'running')
         ORDER BY created_at`,
      )
      .all(teamId, slotId)
      .map(mapIntent)
  }

  listInterruptedIntents(): StoredWorkIntent[] {
    return this.database
      .prepare("SELECT * FROM team_work_intents WHERE status = 'running' ORDER BY created_at")
      .all()
      .map(mapIntent)
  }

  listRunIntents(runId: string): StoredWorkIntent[] {
    return this.database
      .prepare("SELECT * FROM team_work_intents WHERE team_run_id = ? ORDER BY created_at")
      .all(runId)
      .map(mapIntent)
  }

  updateIntent(
    id: string,
    patch: {
      status?: StoredWorkIntent["status"]
      conversationRunId?: string | null
      error?: string | null
      startedAt?: string | null
      completedAt?: string | null
    },
  ): StoredWorkIntent {
    const current = this.requireIntent(id)
    this.database
      .prepare(
        `UPDATE team_work_intents SET
          status = ?, conversation_run_id = ?, error = ?, started_at = ?, completed_at = ?
        WHERE id = ?`,
      )
      .run(
        patch.status ?? current.status,
        patch.conversationRunId === undefined ? (current.conversationRunId ?? null) : patch.conversationRunId,
        patch.error === undefined ? (current.error ?? null) : patch.error,
        patch.startedAt === undefined ? (current.startedAt ?? null) : patch.startedAt,
        patch.completedAt === undefined ? (current.completedAt ?? null) : patch.completedAt,
        id,
      )
    return this.requireIntent(id)
  }

  transitionIntent(
    id: string,
    expectedStatus: StoredWorkIntent["status"],
    patch: {
      status?: StoredWorkIntent["status"]
      conversationRunId?: string | null
      error?: string | null
      startedAt?: string | null
      completedAt?: string | null
    },
  ): StoredWorkIntent | undefined {
    const assignments: string[] = []
    const values: Array<string | null> = []
    if (patch.status !== undefined) {
      assignments.push("status = ?")
      values.push(patch.status)
    }
    if (patch.conversationRunId !== undefined) {
      assignments.push("conversation_run_id = ?")
      values.push(patch.conversationRunId)
    }
    if (patch.error !== undefined) {
      assignments.push("error = ?")
      values.push(patch.error)
    }
    if (patch.startedAt !== undefined) {
      assignments.push("started_at = ?")
      values.push(patch.startedAt)
    }
    if (patch.completedAt !== undefined) {
      assignments.push("completed_at = ?")
      values.push(patch.completedAt)
    }
    if (assignments.length === 0) {
      const intent = this.getIntent(id)
      return intent?.status === expectedStatus ? intent : undefined
    }
    return mapIntent(
      this.database
        .prepare(
          `UPDATE team_work_intents SET ${assignments.join(", ")}
           WHERE id = ? AND status = ?
           RETURNING *`,
        )
        .get(...values, id, expectedStatus),
    )
  }

  createTask(input: CreateTeamTaskRecord): TeamTask {
    return this.transaction(() => {
      this.assertTaskReferences(input.teamId, input.blockedBy, input.ownerSlotId)
      this.database
        .prepare(
          `INSERT INTO team_tasks (
            id, team_id, subject, description, status, owner_slot_id, created_by_slot_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.id,
          input.teamId,
          input.subject,
          input.description,
          input.status,
          input.ownerSlotId ?? null,
          input.createdBySlotId ?? null,
          input.now,
          input.now,
        )
      this.replaceDependencies(input.id, input.blockedBy)
      return this.requireTask(input.id)
    })
  }

  getTask(teamId: string, taskId: string): TeamTask | undefined {
    const row = this.database.prepare("SELECT * FROM team_tasks WHERE team_id = ? AND id = ?").get(teamId, taskId)
    return row ? this.mapTask(row as SqliteRow) : undefined
  }

  listTasks(teamId: string): TeamTask[] {
    return this.database
      .prepare("SELECT * FROM team_tasks WHERE team_id = ? ORDER BY created_at")
      .all(teamId)
      .map((row) => this.mapTask(row as SqliteRow))
  }

  updateTask(
    taskId: string,
    patch: {
      subject?: string
      description?: string
      status?: TeamTask["status"]
      ownerSlotId?: string | null
      blockedBy?: string[]
      updatedAt: string
    },
  ): TeamTask {
    return this.transaction(() => {
      const current = this.requireTask(taskId)
      const blockedBy = patch.blockedBy ?? current.blockedBy
      const ownerSlotId = patch.ownerSlotId === undefined ? current.ownerSlotId : (patch.ownerSlotId ?? undefined)
      this.assertTaskReferences(current.teamId, blockedBy, ownerSlotId)
      assertAcyclic(taskId, blockedBy, this.listTasks(current.teamId))
      this.database
        .prepare(
          `UPDATE team_tasks SET subject = ?, description = ?, status = ?, owner_slot_id = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          patch.subject ?? current.subject,
          patch.description ?? current.description,
          patch.status ?? current.status,
          ownerSlotId ?? null,
          patch.updatedAt,
          taskId,
        )
      if (patch.blockedBy) this.replaceDependencies(taskId, blockedBy)
      return this.requireTask(taskId)
    })
  }

  createSpawnRequest(input: CreateTeamSpawnRequestRecord): TeamSpawnRequest {
    this.database
      .prepare(
        `INSERT INTO team_spawn_requests (
          id, team_id, requested_by_slot_id, name, agent, model, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run(input.id, input.teamId, input.requestedBySlotId, input.name, input.agent, input.model ?? null, input.now)
    return this.requireSpawnRequest(input.id)
  }

  getSpawnRequest(teamId: string, requestId: string): TeamSpawnRequest | undefined {
    const row = this.database
      .prepare("SELECT * FROM team_spawn_requests WHERE team_id = ? AND id = ?")
      .get(teamId, requestId)
    return row ? mapSpawnRequest(row as SqliteRow) : undefined
  }

  listSpawnRequests(teamId: string): TeamSpawnRequest[] {
    return this.database
      .prepare("SELECT * FROM team_spawn_requests WHERE team_id = ? ORDER BY created_at")
      .all(teamId)
      .map(mapSpawnRequest)
  }

  updateSpawnRequest(
    requestId: string,
    patch: { status: TeamSpawnRequest["status"]; memberSlotId?: string; resolvedAt: string },
  ): TeamSpawnRequest {
    this.requireSpawnRequest(requestId)
    this.database
      .prepare("UPDATE team_spawn_requests SET status = ?, member_slot_id = ?, resolved_at = ? WHERE id = ?")
      .run(patch.status, patch.memberSlotId ?? null, patch.resolvedAt, requestId)
    return this.requireSpawnRequest(requestId)
  }

  appendEvent(input: AppendTeamEventInput): TeamEvent {
    const result = this.database
      .prepare(
        `INSERT INTO team_events (id, team_id, team_run_id, slot_id, type, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.teamId,
        input.teamRunId ?? null,
        input.slotId ?? null,
        input.type,
        JSON.stringify(input.data),
        input.createdAt,
      )
    return {
      sequence: Number(result.lastInsertRowid),
      id: input.id,
      teamId: input.teamId,
      ...(input.teamRunId ? { teamRunId: input.teamRunId } : {}),
      ...(input.slotId ? { slotId: input.slotId } : {}),
      type: input.type,
      data: input.data,
      createdAt: input.createdAt,
    }
  }

  listEventsAfter(teamId: string, sequence: number): TeamEvent[] {
    return this.database
      .prepare("SELECT * FROM team_events WHERE team_id = ? AND sequence > ? ORDER BY sequence")
      .all(teamId, sequence)
      .map(mapEvent)
  }

  resetInterruptedWork(): void {
    this.database.exec(`
      UPDATE team_work_intents
      SET status = 'queued', conversation_run_id = NULL, started_at = NULL
      WHERE status = 'running';
      UPDATE team_members
      SET work_status = CASE
        WHEN EXISTS (
          SELECT 1 FROM team_work_intents i
          WHERE i.slot_id = team_members.slot_id AND i.status = 'queued'
        ) THEN 'queued' ELSE 'idle' END
      WHERE work_status IN ('running', 'queued');
    `)
  }

  listQueuedSlots(): Array<{ teamId: string; slotId: string }> {
    return this.database
      .prepare(
        `SELECT DISTINCT team_id, slot_id FROM team_work_intents
         WHERE status = 'queued' ORDER BY team_id, slot_id`,
      )
      .all()
      .map((row) => ({ teamId: String((row as SqliteRow).team_id), slotId: String((row as SqliteRow).slot_id) }))
  }

  private requireTeam(id: string): StoredTeam {
    const team = this.getTeam(id)
    if (!team) throw new TeamError("TEAM_NOT_FOUND", "Team not found.", 404)
    return team
  }

  private requireMember(slotId: string): StoredTeamMember {
    const member = mapMember(this.database.prepare("SELECT * FROM team_members WHERE slot_id = ?").get(slotId))
    if (!member) throw new TeamError("TEAM_MEMBER_NOT_FOUND", "Team member not found.", 404)
    return member
  }

  private requireRun(runId: string): StoredTeamRun {
    const run = mapRun(this.database.prepare("SELECT * FROM team_runs WHERE id = ?").get(runId))
    if (!run) throw new TeamError("TEAM_RUN_NOT_FOUND", "Team run not found.", 404)
    return run
  }

  private requireMessage(id: string): StoredTeamMessage {
    const message = this.getMessage(id)
    if (!message) throw new TeamError("TEAM_MESSAGE_NOT_FOUND", "Team message not found.", 404)
    return message
  }

  private requireIntent(id: string): StoredWorkIntent {
    const intent = this.getIntent(id)
    if (!intent) throw new TeamError("TEAM_INTENT_NOT_FOUND", "Team work intent not found.", 404)
    return intent
  }

  private requireTask(id: string): TeamTask {
    const row = this.database.prepare("SELECT * FROM team_tasks WHERE id = ?").get(id)
    if (!row) throw new TeamError("TEAM_TASK_NOT_FOUND", "Team task not found.", 404)
    return this.mapTask(row as SqliteRow)
  }

  private requireSpawnRequest(id: string): TeamSpawnRequest {
    const row = this.database.prepare("SELECT * FROM team_spawn_requests WHERE id = ?").get(id)
    if (!row) throw new TeamError("TEAM_SPAWN_REQUEST_NOT_FOUND", "Team spawn request not found.", 404)
    return mapSpawnRequest(row as SqliteRow)
  }

  private mapTask(row: SqliteRow): TeamTask {
    return {
      id: String(row.id),
      teamId: String(row.team_id),
      subject: String(row.subject),
      description: String(row.description),
      status: String(row.status) as TeamTask["status"],
      ...(row.owner_slot_id ? { ownerSlotId: String(row.owner_slot_id) } : {}),
      blockedBy: this.database
        .prepare("SELECT blocked_by_task_id FROM team_task_dependencies WHERE task_id = ? ORDER BY rowid")
        .all(String(row.id))
        .map((item) => String((item as SqliteRow).blocked_by_task_id)),
      ...(row.created_by_slot_id ? { createdBySlotId: String(row.created_by_slot_id) } : {}),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }
  }

  private assertTaskReferences(teamId: string, blockedBy: string[], ownerSlotId?: string): void {
    if (ownerSlotId && !this.getMember(teamId, ownerSlotId)) {
      throw new TeamError("TEAM_TASK_OWNER_NOT_FOUND", "Task owner is not a member of this team.", 400)
    }
    for (const taskId of blockedBy) {
      if (!this.getTask(teamId, taskId)) {
        throw new TeamError("TEAM_TASK_DEPENDENCY_NOT_FOUND", "Task dependency was not found in this team.", 400)
      }
    }
  }

  private replaceDependencies(taskId: string, blockedBy: string[]): void {
    this.database.prepare("DELETE FROM team_task_dependencies WHERE task_id = ?").run(taskId)
    const insert = this.database.prepare(
      "INSERT INTO team_task_dependencies (task_id, blocked_by_task_id) VALUES (?, ?)",
    )
    for (const dependencyId of new Set(blockedBy)) insert.run(taskId, dependencyId)
  }

  private migrate(): void {
    this.database.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        canvas_id TEXT NOT NULL,
        name TEXT NOT NULL,
        workspace TEXT NOT NULL,
        leader_slot_id TEXT NOT NULL,
        session_status TEXT NOT NULL,
        lifecycle_status TEXT NOT NULL DEFAULT 'active',
        control_token_hash TEXT NOT NULL DEFAULT '',
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS team_members (
        slot_id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        role TEXT NOT NULL,
        agent TEXT NOT NULL,
        model TEXT,
        role_preset_id TEXT,
        role_prompt TEXT,
        mcp_token TEXT NOT NULL UNIQUE,
        runtime_status TEXT NOT NULL,
        work_status TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(team_id, normalized_name)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_team_one_leader
        ON team_members(team_id) WHERE role = 'leader';

      CREATE TRIGGER IF NOT EXISTS enforce_team_member_limit
      BEFORE INSERT ON team_members
      WHEN (SELECT COUNT(*) FROM team_members WHERE team_id = NEW.team_id) >= 8
      BEGIN
        SELECT RAISE(ABORT, 'TEAM_MEMBER_LIMIT');
      END;

      CREATE TABLE IF NOT EXISTS team_runs (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        target_slot_id TEXT NOT NULL,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        has_user_intervention INTEGER NOT NULL DEFAULT 0,
        error TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS team_mailbox (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        team_run_id TEXT NOT NULL REFERENCES team_runs(id) ON DELETE CASCADE,
        from_slot_id TEXT,
        to_slot_id TEXT NOT NULL,
        source TEXT NOT NULL,
        content TEXT NOT NULL,
        attachments TEXT NOT NULL,
        status TEXT NOT NULL,
        client_message_id TEXT,
        created_at TEXT NOT NULL,
        delivered_at TEXT,
        UNIQUE(team_id, client_message_id)
      );

      CREATE TABLE IF NOT EXISTS team_work_intents (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        team_run_id TEXT NOT NULL REFERENCES team_runs(id) ON DELETE CASCADE,
        slot_id TEXT NOT NULL,
        message_id TEXT NOT NULL REFERENCES team_mailbox(id) ON DELETE CASCADE,
        conversation_run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
        status TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS team_tasks (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        owner_slot_id TEXT,
        created_by_slot_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS team_task_dependencies (
        task_id TEXT NOT NULL REFERENCES team_tasks(id) ON DELETE CASCADE,
        blocked_by_task_id TEXT NOT NULL REFERENCES team_tasks(id) ON DELETE CASCADE,
        PRIMARY KEY(task_id, blocked_by_task_id),
        CHECK(task_id <> blocked_by_task_id)
      );

      CREATE TABLE IF NOT EXISTS team_spawn_requests (
        id TEXT PRIMARY KEY,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        requested_by_slot_id TEXT NOT NULL,
        name TEXT NOT NULL,
        agent TEXT NOT NULL,
        model TEXT,
        status TEXT NOT NULL,
        member_slot_id TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );

      CREATE TABLE IF NOT EXISTS team_events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        team_run_id TEXT,
        slot_id TEXT,
        type TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_teams_canvas ON teams(canvas_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_team_intents_slot_status
        ON team_work_intents(team_id, slot_id, status, created_at);
      CREATE INDEX IF NOT EXISTS idx_team_events_sequence ON team_events(team_id, sequence);
    `)
    ensureColumn(this.database, "teams", "lifecycle_status", "TEXT NOT NULL DEFAULT 'active'")
    ensureColumn(this.database, "teams", "control_token_hash", "TEXT NOT NULL DEFAULT ''")
    ensureColumn(this.database, "team_members", "role_preset_id", "TEXT")
    ensureColumn(this.database, "team_members", "role_prompt", "TEXT")
  }
}

function mapTeam(row: SqliteRow | undefined): StoredTeam | undefined
function mapTeam(row: SqliteRow): StoredTeam
function mapTeam(row: SqliteRow | undefined): StoredTeam | undefined {
  if (!row) return undefined
  return {
    id: String(row.id),
    canvasId: String(row.canvas_id),
    name: String(row.name),
    workspace: String(row.workspace),
    leaderSlotId: String(row.leader_slot_id),
    sessionStatus: String(row.session_status) as StoredTeam["sessionStatus"],
    lifecycleStatus: String(row.lifecycle_status) as StoredTeam["lifecycleStatus"],
    controlTokenHash: String(row.control_token_hash ?? ""),
    ...(row.error ? { error: String(row.error) } : {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapMember(row: SqliteRow | undefined): StoredTeamMember | undefined
function mapMember(row: SqliteRow): StoredTeamMember
function mapMember(row: SqliteRow | undefined): StoredTeamMember | undefined {
  if (!row) return undefined
  return {
    slotId: String(row.slot_id),
    teamId: String(row.team_id),
    conversationId: String(row.conversation_id),
    name: String(row.name),
    role: String(row.role) as TeamMember["role"],
    agent: String(row.agent) as TeamMember["agent"],
    ...(row.model ? { model: String(row.model) } : {}),
    ...(row.role_preset_id ? { rolePresetId: String(row.role_preset_id) } : {}),
    ...(row.role_prompt ? { rolePrompt: String(row.role_prompt) } : {}),
    mcpToken: String(row.mcp_token),
    runtimeStatus: String(row.runtime_status) as TeamMember["runtimeStatus"],
    workStatus: String(row.work_status) as TeamMember["workStatus"],
    ...(row.error ? { error: String(row.error) } : {}),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function publicMember(member: StoredTeamMember): TeamMember {
  const { mcpToken: _mcpToken, rolePrompt: _rolePrompt, ...value } = member
  return value
}

function mapRun(row: SqliteRow | undefined): StoredTeamRun | undefined
function mapRun(row: SqliteRow): StoredTeamRun
function mapRun(row: SqliteRow | undefined): StoredTeamRun | undefined {
  if (!row) return undefined
  return {
    id: String(row.id),
    teamId: String(row.team_id),
    targetSlotId: String(row.target_slot_id),
    status: String(row.status) as TeamRun["status"],
    source: String(row.source) as TeamRun["source"],
    hasUserIntervention: Boolean(row.has_user_intervention),
    ...(row.error ? { error: String(row.error) } : {}),
    createdAt: String(row.created_at),
    ...(row.started_at ? { startedAt: String(row.started_at) } : {}),
    ...(row.completed_at ? { completedAt: String(row.completed_at) } : {}),
  }
}

function mapMessage(row: SqliteRow | undefined): StoredTeamMessage | undefined
function mapMessage(row: SqliteRow): StoredTeamMessage
function mapMessage(row: SqliteRow | undefined): StoredTeamMessage | undefined {
  if (!row) return undefined
  return {
    id: String(row.id),
    teamId: String(row.team_id),
    teamRunId: String(row.team_run_id),
    ...(row.from_slot_id ? { fromSlotId: String(row.from_slot_id) } : {}),
    toSlotId: String(row.to_slot_id),
    source: String(row.source) as StoredTeamMessage["source"],
    content: String(row.content),
    attachments: parseJson(row.attachments, []),
    status: String(row.status) as StoredTeamMessage["status"],
    ...(row.client_message_id ? { clientMessageId: String(row.client_message_id) } : {}),
    createdAt: String(row.created_at),
    ...(row.delivered_at ? { deliveredAt: String(row.delivered_at) } : {}),
  }
}

function mapIntent(row: SqliteRow | undefined): StoredWorkIntent | undefined
function mapIntent(row: SqliteRow): StoredWorkIntent
function mapIntent(row: SqliteRow | undefined): StoredWorkIntent | undefined {
  if (!row) return undefined
  return {
    id: String(row.id),
    teamId: String(row.team_id),
    teamRunId: String(row.team_run_id),
    slotId: String(row.slot_id),
    messageId: String(row.message_id),
    ...(row.conversation_run_id ? { conversationRunId: String(row.conversation_run_id) } : {}),
    status: String(row.status) as StoredWorkIntent["status"],
    ...(row.error ? { error: String(row.error) } : {}),
    createdAt: String(row.created_at),
    ...(row.started_at ? { startedAt: String(row.started_at) } : {}),
    ...(row.completed_at ? { completedAt: String(row.completed_at) } : {}),
  }
}

function mapSpawnRequest(row: SqliteRow): TeamSpawnRequest {
  return {
    id: String(row.id),
    teamId: String(row.team_id),
    requestedBySlotId: String(row.requested_by_slot_id),
    name: String(row.name),
    agent: String(row.agent) as TeamSpawnRequest["agent"],
    ...(row.model ? { model: String(row.model) } : {}),
    status: String(row.status) as TeamSpawnRequest["status"],
    ...(row.member_slot_id ? { memberSlotId: String(row.member_slot_id) } : {}),
    createdAt: String(row.created_at),
    ...(row.resolved_at ? { resolvedAt: String(row.resolved_at) } : {}),
  }
}

function mapEvent(row: SqliteRow): TeamEvent {
  return {
    sequence: Number(row.sequence),
    id: String(row.id),
    teamId: String(row.team_id),
    ...(row.team_run_id ? { teamRunId: String(row.team_run_id) } : {}),
    ...(row.slot_id ? { slotId: String(row.slot_id) } : {}),
    type: String(row.type) as TeamEvent["type"],
    data: parseJson(row.data, null),
    createdAt: String(row.created_at),
  }
}

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase("en-US")
}

function ensureColumn(database: DatabaseSync, table: string, column: string, definition: string): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<Record<string, unknown>>
  if (columns.some((item) => item.name === column)) return
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function assertAcyclic(taskId: string, blockedBy: string[], tasks: TeamTask[]): void {
  const dependencies = new Map(tasks.map((task) => [task.id, task.id === taskId ? blockedBy : task.blockedBy]))
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string): void => {
    if (visiting.has(id))
      throw new TeamError("TEAM_TASK_DEPENDENCY_CYCLE", "Task dependencies cannot form a cycle.", 400)
    if (visited.has(id)) return
    visiting.add(id)
    for (const dependency of dependencies.get(id) ?? []) visit(dependency)
    visiting.delete(id)
    visited.add(id)
  }
  for (const id of dependencies.keys()) visit(id)
}

export function createMemoryTeamRepository(database: DatabaseSync): SqliteTeamRepository {
  return new SqliteTeamRepository(database)
}

export const teamRepository: TeamRepository = new SqliteTeamRepository()
