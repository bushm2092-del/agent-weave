import type { DatabaseSync } from "node:sqlite"
import type { RolePreset } from "@agent-weave/contracts"
import { appDatabase } from "../../database/index.js"

type RolePresetRow = {
  id: string
  name: string
  description: string
  category: string
  agent: RolePreset["agent"]
  system_prompt: string
  built_in: number
  created_at: string
  updated_at: string
}

export class RolePresetRepository {
  constructor(private readonly database: DatabaseSync = appDatabase) {
    this.migrate()
  }

  list(): RolePreset[] {
    return (this.database.prepare("SELECT * FROM role_presets ORDER BY built_in DESC, category, name").all() as RolePresetRow[]).map(mapPreset)
  }

  get(id: string): RolePreset | undefined {
    const row = this.database.prepare("SELECT * FROM role_presets WHERE id = ?").get(id) as RolePresetRow | undefined
    return row ? mapPreset(row) : undefined
  }

  create(preset: RolePreset): RolePreset {
    this.database.prepare(`
      INSERT INTO role_presets (id, name, description, category, agent, system_prompt, built_in, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(preset.id, preset.name, preset.description, preset.category, preset.agent, preset.systemPrompt, preset.builtIn ? 1 : 0, preset.createdAt, preset.updatedAt)
    return preset
  }

  update(preset: RolePreset): RolePreset {
    this.database.prepare(`
      UPDATE role_presets SET name = ?, description = ?, category = ?, agent = ?, system_prompt = ?, updated_at = ?
      WHERE id = ?
    `).run(preset.name, preset.description, preset.category, preset.agent, preset.systemPrompt, preset.updatedAt, preset.id)
    return preset
  }

  delete(id: string): boolean {
    return this.database.prepare("DELETE FROM role_presets WHERE id = ? AND built_in = 0").run(id).changes > 0
  }

  private migrate(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS role_presets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        agent TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        built_in INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_role_presets_category ON role_presets(category, name);
    `)
    const now = new Date().toISOString()
    const insert = this.database.prepare(`
      INSERT OR IGNORE INTO role_presets
        (id, name, description, category, agent, system_prompt, built_in, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `)
    for (const preset of BUILT_IN_PRESETS) {
      insert.run(preset.id, preset.name, preset.description, preset.category, preset.agent, preset.systemPrompt, now, now)
    }
  }
}

const BUILT_IN_PRESETS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Product manager",
    description: "Turns an idea into clear requirements, priorities, and an execution plan.",
    category: "Planning",
    agent: "codex",
    systemPrompt: "Act as a product manager. Clarify the user outcome, identify constraints, write testable requirements, prioritize scope, and maintain an explicit execution plan. Surface product risks and unresolved decisions early.",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Deep researcher",
    description: "Investigates a topic, compares sources, and delivers a structured brief.",
    category: "Research",
    agent: "pi",
    systemPrompt: "Act as a rigorous researcher. Decompose the question, gather primary evidence, compare conflicting claims, distinguish facts from inference, cite sources when available, and deliver a structured synthesis with limitations.",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Software engineer",
    description: "Designs, implements, tests, and reviews production-ready changes.",
    category: "Build",
    agent: "codex",
    systemPrompt: "Act as a senior software engineer. Inspect the existing system before changing it, keep changes scoped, preserve compatibility, write maintainable code, test behavior in proportion to risk, and report concrete verification results.",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Content writer",
    description: "Creates concise, audience-aware drafts with a consistent voice.",
    category: "Create",
    agent: "claude",
    systemPrompt: "Act as an audience-aware content writer. Establish purpose, reader, voice, and desired action before drafting. Prefer concrete language, coherent structure, accurate claims, and concise revisions over generic filler.",
  },
] as const

function mapPreset(row: RolePresetRow): RolePreset {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    agent: row.agent,
    systemPrompt: row.system_prompt,
    builtIn: Boolean(row.built_in),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const rolePresetRepository = new RolePresetRepository()
