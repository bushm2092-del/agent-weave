import type { RolePreset } from "@agent-weave/contracts"
import { describe, expect, it } from "vitest"

import { createAppI18n } from "./i18n"
import { localizeRolePreset, localizeRolePresetCategory } from "./role-presets"

const BUILT_IN_PRESETS: readonly RolePreset[] = [
  preset("11111111-1111-4111-8111-111111111111", "Product manager", "Planning", "product-prompt"),
  preset("22222222-2222-4222-8222-222222222222", "Deep researcher", "Research", "research-prompt", "pi"),
  preset("33333333-3333-4333-8333-333333333333", "Software engineer", "Build", "engineer-prompt"),
  preset("44444444-4444-4444-8444-444444444444", "Content writer", "Create", "writer-prompt", "claude"),
]

const EXPECTED = {
  en: [
    ["Product manager", "Planning", "Turns an idea into clear requirements, priorities, and an execution plan."],
    ["Deep researcher", "Research", "Investigates a topic, compares sources, and delivers a structured brief."],
    ["Software engineer", "Build", "Designs, implements, tests, and reviews production-ready changes."],
    ["Content writer", "Create", "Creates concise, audience-aware drafts with a consistent voice."],
  ],
  "zh-CN": [
    ["产品经理", "规划", "将想法转化为清晰的需求、优先级和执行计划。"],
    ["深度研究员", "研究", "深入调研主题、比较信息来源，并交付结构化简报。"],
    ["软件工程师", "开发", "设计、实现、测试并审查可用于生产环境的变更。"],
    ["内容创作者", "创作", "以一致的表达风格创作简洁、贴合受众的文稿。"],
  ],
} as const

describe("Role Preset localization", () => {
  it.each(["en", "zh-CN"] as const)("overlays all built-in display metadata in %s", (locale) => {
    const i18n = createAppI18n({ initialLocale: locale, storage: null })

    BUILT_IN_PRESETS.forEach((source, index) => {
      const localized = localizeRolePreset(source, i18n.t)
      const [name, category, description] = EXPECTED[locale][index]
      expect({ name: localized.name, category: localized.category, description: localized.description }).toEqual({
        name,
        category,
        description,
      })
      expect(localizeRolePresetCategory(source, i18n.t)).toBe(category)
      expect(localized.systemPrompt).toBe(source.systemPrompt)
      expect({ ...localized, name: source.name, category: source.category, description: source.description }).toEqual(
        source,
      )
    })
  })

  it.each(["en", "zh-CN"] as const)("returns a custom preset byte-for-byte unchanged in %s", (locale) => {
    const i18n = createAppI18n({ initialLocale: locale, storage: null })
    const custom = preset(
      "55555555-5555-4555-8555-555555555555",
      "用户自定义 Role",
      "My category",
      "Do exactly what the user wrote.",
      "opencode",
      false,
    )

    expect(localizeRolePreset(custom, i18n.t)).toBe(custom)
    expect(JSON.stringify(localizeRolePreset(custom, i18n.t))).toBe(JSON.stringify(custom))
    expect(localizeRolePresetCategory(custom, i18n.t)).toBe(custom.category)
  })
})

function preset(
  id: string,
  name: string,
  category: string,
  systemPrompt: string,
  agent: RolePreset["agent"] = "codex",
  builtIn = true,
): RolePreset {
  return {
    id,
    name,
    description: `canonical-description:${id}`,
    category,
    agent,
    systemPrompt,
    builtIn,
    createdAt: "2026-08-30T00:00:00.000Z",
    updatedAt: "2026-08-30T00:00:00.000Z",
  }
}
