import { randomUUID } from "node:crypto"
import type { CreateRolePresetRequest, RolePreset, UpdateRolePresetRequest } from "@agent-weave/contracts"
import { RolePresetError } from "./role-preset.errors.js"
import { rolePresetRepository, type RolePresetRepository } from "./role-preset.repository.js"

export class RolePresetService {
  constructor(private readonly repository: RolePresetRepository) {}

  list(): RolePreset[] { return this.repository.list() }

  get(id: string): RolePreset {
    const preset = this.repository.get(id)
    if (!preset) throw new RolePresetError("ROLE_PRESET_NOT_FOUND", "Role preset not found.", 404)
    return preset
  }

  create(input: CreateRolePresetRequest): RolePreset {
    const now = new Date().toISOString()
    return this.repository.create({ id: randomUUID(), ...input, builtIn: false, createdAt: now, updatedAt: now })
  }

  update(id: string, input: UpdateRolePresetRequest): RolePreset {
    const current = this.get(id)
    return this.repository.update({
      ...current,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      category: input.category ?? current.category,
      agent: input.agent ?? current.agent,
      systemPrompt: input.systemPrompt ?? current.systemPrompt,
      updatedAt: new Date().toISOString(),
    })
  }

  delete(id: string): void {
    const current = this.get(id)
    if (current.builtIn) throw new RolePresetError("ROLE_PRESET_BUILT_IN", "Built-in role presets cannot be deleted.", 409)
    this.repository.delete(id)
  }
}

export const rolePresetService = new RolePresetService(rolePresetRepository)
