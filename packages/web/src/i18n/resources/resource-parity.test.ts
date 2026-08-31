import { describe, expect, it } from "vitest"

import en from "./en"
import zhCN from "./zh-CN"

function flattenKeys(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key

    return child && typeof child === "object" && !Array.isArray(child)
      ? flattenKeys(child as Record<string, unknown>, path)
      : [path]
  })
}

describe("translation resources", () => {
  it("keeps English and Simplified Chinese semantic key trees in sync", () => {
    expect(flattenKeys(zhCN).sort()).toEqual(flattenKeys(en).sort())
  })

  it("formats raw and localized canvas counts with English singular and plural forms", async () => {
    const { createAppI18n } = await import("../i18n")
    const i18n = await createAppI18n({ initialLocale: "en" })

    expect(i18n.t("home.canvasCount", { count: 1, formattedCount: "1" })).toBe("1 canvas")
    expect(i18n.t("home.canvasCount", { count: 2, formattedCount: "2" })).toBe("2 canvases")
    expect(i18n.t("home.canvasCount", { count: 1000, formattedCount: "1,000" })).toBe("1,000 canvases")
  })

  it("selects team task singular and plural forms by raw total while rendering localized numbers", async () => {
    const { createAppI18n } = await import("../i18n")
    const i18n = await createAppI18n({ initialLocale: "en" })

    expect(i18n.t("teams.taskCount", { count: 1, formattedCompleted: "1", formattedTotal: "1" })).toBe("1/1 task")
    expect(i18n.t("teams.taskCount", { count: 2, formattedCompleted: "1", formattedTotal: "2" })).toBe("1/2 tasks")
    expect(i18n.t("teams.taskCount", { count: 1000, formattedCompleted: "1,000", formattedTotal: "1,000" })).toBe(
      "1,000/1,000 tasks",
    )

    await i18n.changeLanguage("zh-CN")
    expect(i18n.t("teams.taskCount", { count: 1, formattedCompleted: "1", formattedTotal: "1" })).toBe("1/1 个任务")
  })
})
