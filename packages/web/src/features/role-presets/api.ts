import type { CreateRolePresetRequest, RolePreset, UpdateRolePresetRequest } from "@agent-weave/contracts"
import { apiClient } from "@/lib/api"

const path = "/role-presets"

export const rolePresetApi = {
  list: (): Promise<RolePreset[]> => apiClient.get(path),
  create: (input: CreateRolePresetRequest): Promise<RolePreset> => apiClient.post(path, input),
  update: (id: string, input: UpdateRolePresetRequest): Promise<RolePreset> =>
    apiClient.patch(`${path}/${encodeURIComponent(id)}`, input),
  delete: (id: string): Promise<{ presetId: string; deleted: boolean }> =>
    apiClient.delete(`${path}/${encodeURIComponent(id)}`),
}
