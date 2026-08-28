import type { DatabaseSync, StatementSync } from "node:sqlite"
import type { CanvasAccent } from "@agent-weave/contracts"
import { appDatabase } from "../../../database/index.js"
import type { CanvasRepository, StoredCanvas } from "../canvas.models.js"

type CanvasRow = {
  id: string
  name: string
  description: string
  accent: string
  created_at: string
  updated_at: string
}

type SnapshotRow = { snapshot_json: string; thumbnail_data_url: string | null; updated_at: string }

export class SqliteCanvasRepository implements CanvasRepository {
  private readonly insertCanvas: StatementSync
  private readonly selectCanvas: StatementSync
  private readonly selectCanvases: StatementSync
  private readonly deleteCanvasStatement: StatementSync
  private readonly selectSnapshot: StatementSync
  private readonly upsertSnapshot: StatementSync

  constructor(
    private readonly database: DatabaseSync = appDatabase,
    options: { seedLegacyCanvases?: boolean } = {},
  ) {
    this.migrate()
    this.insertCanvas = database.prepare(`
      INSERT INTO canvases (id, name, description, accent, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    this.selectCanvas = database.prepare("SELECT * FROM canvases WHERE id = ?")
    this.selectCanvases = database.prepare("SELECT * FROM canvases ORDER BY updated_at DESC")
    this.deleteCanvasStatement = database.prepare("DELETE FROM canvases WHERE id = ?")
    this.selectSnapshot = database.prepare(
      "SELECT snapshot_json, thumbnail_data_url, updated_at FROM canvas_snapshots WHERE canvas_id = ?",
    )
    this.upsertSnapshot = database.prepare(`
      INSERT INTO canvas_snapshots (canvas_id, snapshot_json, thumbnail_data_url, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(canvas_id) DO UPDATE SET
        snapshot_json = excluded.snapshot_json,
        thumbnail_data_url = excluded.thumbnail_data_url,
        updated_at = excluded.updated_at
    `)
    if (options.seedLegacyCanvases) this.seedLegacyCanvases()
  }

  create(canvas: StoredCanvas): StoredCanvas {
    this.insertCanvas.run(canvas.id, canvas.name, canvas.description, canvas.accent, canvas.createdAt, canvas.updatedAt)
    return canvas
  }

  get(canvasId: string): StoredCanvas | undefined {
    return mapCanvas(this.selectCanvas.get(canvasId) as CanvasRow | undefined)
  }

  list(): StoredCanvas[] {
    return (this.selectCanvases.all() as CanvasRow[]).map((row) => mapCanvas(row)!)
  }

  update(
    canvasId: string,
    patch: Partial<Pick<StoredCanvas, "name" | "description" | "accent" | "updatedAt">>,
  ): StoredCanvas | undefined {
    const current = this.get(canvasId)
    if (!current) return undefined
    const next = { ...current, ...patch }
    this.database
      .prepare("UPDATE canvases SET name = ?, description = ?, accent = ?, updated_at = ? WHERE id = ?")
      .run(next.name, next.description, next.accent, next.updatedAt, canvasId)
    return next
  }

  delete(canvasId: string): boolean {
    return this.deleteCanvasStatement.run(canvasId).changes > 0
  }

  getSnapshot(canvasId: string): { document: unknown; thumbnailDataUrl: string | null; updatedAt: string } | undefined {
    const row = this.selectSnapshot.get(canvasId) as SnapshotRow | undefined
    return row
      ? { document: JSON.parse(row.snapshot_json), thumbnailDataUrl: row.thumbnail_data_url, updatedAt: row.updated_at }
      : undefined
  }

  saveSnapshot(canvasId: string, document: unknown, thumbnailDataUrl: string | null, updatedAt: string): void {
    this.upsertSnapshot.run(canvasId, JSON.stringify(document), thumbnailDataUrl, updatedAt)
    this.database.prepare("UPDATE canvases SET updated_at = ? WHERE id = ?").run(updatedAt, canvasId)
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS canvases (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        accent TEXT NOT NULL DEFAULT 'blue',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS canvas_snapshots (
        canvas_id TEXT PRIMARY KEY REFERENCES canvases(id) ON DELETE CASCADE,
        snapshot_json TEXT NOT NULL,
        thumbnail_data_url TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_canvases_updated_at ON canvases(updated_at DESC);

      CREATE TABLE IF NOT EXISTS canvas_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `)
    ensureColumn(this.database, "canvas_snapshots", "thumbnail_data_url", "TEXT")
  }

  private seedLegacyCanvases(): void {
    const migrationName = "seed-static-workspaces-v1"
    const applied = this.database.prepare("SELECT 1 FROM canvas_migrations WHERE name = ?").get(migrationName)
    if (applied) return
    const now = Date.now()
    const canvases: StoredCanvas[] = [
      {
        id: "product-launch",
        name: "Product launch",
        description: "Research, positioning, and launch execution",
        accent: "coral",
        createdAt: new Date(now - 86_400_000).toISOString(),
        updatedAt: new Date(now).toISOString(),
      },
      {
        id: "code-review",
        name: "Code review team",
        description: "Implementation, review, and test workflow",
        accent: "green",
        createdAt: new Date(now - 86_400_000).toISOString(),
        updatedAt: new Date(now - 7_200_000).toISOString(),
      },
      {
        id: "research-lab",
        name: "Research lab",
        description: "Parallel exploration and synthesis",
        accent: "blue",
        createdAt: new Date(now - 86_400_000).toISOString(),
        updatedAt: new Date(now - 86_400_000).toISOString(),
      },
    ]
    this.database.exec("BEGIN IMMEDIATE")
    try {
      const insert = this.database.prepare(`
        INSERT OR IGNORE INTO canvases (id, name, description, accent, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      for (const canvas of canvases) {
        insert.run(canvas.id, canvas.name, canvas.description, canvas.accent, canvas.createdAt, canvas.updatedAt)
      }
      this.database
        .prepare("INSERT INTO canvas_migrations (name, applied_at) VALUES (?, ?)")
        .run(migrationName, new Date(now).toISOString())
      this.database.exec("COMMIT")
    } catch (error) {
      this.database.exec("ROLLBACK")
      throw error
    }
  }
}

function ensureColumn(database: DatabaseSync, table: string, column: string, definition: string): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as Array<Record<string, unknown>>
  if (!columns.some((item) => item.name === column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
}

function mapCanvas(row: CanvasRow | undefined): StoredCanvas | undefined {
  if (!row) return undefined
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    accent: row.accent as CanvasAccent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const canvasRepository = new SqliteCanvasRepository(appDatabase, { seedLegacyCanvases: true })
