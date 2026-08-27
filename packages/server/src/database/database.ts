import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"
import { environment } from "../config/index.js"

export function createDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true })
  const database = new DatabaseSync(path)
  database.exec("PRAGMA foreign_keys = ON;")
  if (path !== ":memory:") database.exec("PRAGMA journal_mode = WAL;")
  return database
}

export function transaction<T>(database: DatabaseSync, operation: () => T): T {
  database.exec("BEGIN IMMEDIATE")
  try {
    const result = operation()
    database.exec("COMMIT")
    return result
  } catch (error) {
    database.exec("ROLLBACK")
    throw error
  }
}

export const appDatabase = createDatabase(environment.databasePath)
