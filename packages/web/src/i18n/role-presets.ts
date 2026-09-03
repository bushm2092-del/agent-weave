import type { RolePreset } from "@agent-weave/contracts"
import type { TFunction } from "i18next"

const BUILT_IN_PRESET_KEYS = {
  "11111111-1111-4111-8111-111111111111": "productManager",
  "22222222-2222-4222-8222-222222222222": "deepResearcher",
  "33333333-3333-4333-8333-333333333333": "softwareEngineer",
  "44444444-4444-4444-8444-444444444444": "contentWriter",
} as const

export function localizeRolePreset(preset: RolePreset, t: TFunction): RolePreset {
  const key = BUILT_IN_PRESET_KEYS[preset.id as keyof typeof BUILT_IN_PRESET_KEYS]
  if (!key) return preset
  return {
    ...preset,
    name: t(`presets.builtIns.${key}.name`),
    category: t(`presets.builtIns.${key}.category`),
    description: t(`presets.builtIns.${key}.description`),
  }
}

export function localizeRolePresetCategory(preset: RolePreset, t: TFunction): string {
  const key = BUILT_IN_PRESET_KEYS[preset.id as keyof typeof BUILT_IN_PRESET_KEYS]
  return key ? t(`presets.builtIns.${key}.category`) : preset.category
}
