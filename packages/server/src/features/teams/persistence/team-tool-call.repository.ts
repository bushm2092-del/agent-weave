import { DatabaseSync } from "node:sqlite"
import { appDatabase } from "../../../database/index.js"

export type TeamToolCallKey = {
  callerSlotId: string
  requestId: string
  toolName: string
}

export interface TeamToolCallRepository {
  run<Result>(key: TeamToolCallKey, action: () => Result): Result
}

export class SqliteTeamToolCallRepository implements TeamToolCallRepository {
  constructor(private readonly database: DatabaseSync = appDatabase) {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS team_tool_calls (
        caller_slot_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        result_json TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        PRIMARY KEY (caller_slot_id, request_id, tool_name)
      );
    `)
  }

  run<Result>(key: TeamToolCallKey, action: () => Result): Result {
    return this.transaction(() => {
      const stored = this.getResult(key)
      if (stored !== undefined) return stored as Result
      const result = action()
      return this.storeResult(key, result) as Result
    })
  }

  private getResult(key: TeamToolCallKey): unknown | undefined {
    const row = this.database
      .prepare(
        `SELECT result_json
         FROM team_tool_calls
         WHERE caller_slot_id = ? AND request_id = ? AND tool_name = ?`,
      )
      .get(key.callerSlotId, key.requestId, key.toolName) as { result_json: string } | undefined
    return row ? JSON.parse(row.result_json) : undefined
  }

  private storeResult(key: TeamToolCallKey, result: unknown): unknown {
    const resultJson = JSON.stringify(result)
    if (resultJson === undefined) throw new TypeError("Team tool results must be JSON serializable.")
    this.database
      .prepare(
        `INSERT INTO team_tool_calls (
          caller_slot_id, request_id, tool_name, result_json, completed_at
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(caller_slot_id, request_id, tool_name) DO NOTHING`,
      )
      .run(key.callerSlotId, key.requestId, key.toolName, resultJson, new Date().toISOString())
    return this.getResult(key)
  }

  private transaction<Result>(action: () => Result): Result {
    if (!this.database.isTransaction) {
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

    const savepoint = `team_tool_call_${nextSavepointId++}`
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
}

export class MemoryTeamToolCallRepository implements TeamToolCallRepository {
  private readonly results = new Map<string, string>()

  run<Result>(key: TeamToolCallKey, action: () => Result): Result {
    const resultJson = this.results.get(toMapKey(key))
    if (resultJson !== undefined) return JSON.parse(resultJson) as Result
    const result = action()
    const serialized = JSON.stringify(result)
    if (serialized === undefined) throw new TypeError("Team tool results must be JSON serializable.")
    this.results.set(toMapKey(key), serialized)
    return JSON.parse(serialized) as Result
  }
}

function toMapKey(key: TeamToolCallKey): string {
  return JSON.stringify([key.callerSlotId, key.requestId, key.toolName])
}

let nextSavepointId = 0

export const teamToolCallRepository = new SqliteTeamToolCallRepository()
