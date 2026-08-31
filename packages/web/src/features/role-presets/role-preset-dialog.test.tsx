import type { RolePreset } from "@agent-weave/contracts"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "@/i18n"

import { RolePresetDialog } from "./role-preset-dialog"

afterEach(cleanup)

describe("RolePresetDialog built-in display metadata", () => {
  it("updates untouched built-in fields when the open dialog locale changes", async () => {
    const i18n = createAppI18n({ initialLocale: "en", storage: null })

    render(
      <I18nextProvider i18n={i18n}>
        <RolePresetDialog preset={PRODUCT_MANAGER} onClose={() => undefined} onSave={vi.fn()} />
      </I18nextProvider>,
    )

    expect(screen.getByLabelText("Name")).toHaveValue("Product manager")
    expect(screen.getByLabelText("Category")).toHaveValue("Planning")
    expect(screen.getByLabelText("Description")).toHaveValue(
      "Turns an idea into clear requirements, priorities, and an execution plan.",
    )

    await act(() => i18n.changeLanguage("zh-CN"))

    expect(screen.getByLabelText("名称")).toHaveValue("产品经理")
    expect(screen.getByLabelText("分类")).toHaveValue("规划")
    expect(screen.getByLabelText("描述")).toHaveValue("将想法转化为清晰的需求、优先级和执行计划。")
    expect(screen.getByLabelText("系统提示词")).toHaveValue(PRODUCT_MANAGER.systemPrompt)
  })

  it("keeps a dirty localized field when the open dialog locale changes", async () => {
    const user = userEvent.setup()
    const i18n = createAppI18n({ initialLocale: "en", storage: null })

    render(
      <I18nextProvider i18n={i18n}>
        <RolePresetDialog preset={PRODUCT_MANAGER} onClose={() => undefined} onSave={vi.fn()} />
      </I18nextProvider>,
    )

    const name = screen.getByLabelText("Name")
    await user.clear(name)
    await user.type(name, "My planning lead")

    await act(() => i18n.changeLanguage("zh-CN"))

    expect(name).toHaveValue("My planning lead")
    expect(screen.getByLabelText("分类")).toHaveValue("规划")
    expect(screen.getByLabelText("描述")).toHaveValue("将想法转化为清晰的需求、优先级和执行计划。")
  })

  it("saves canonical built-in metadata after switching locale without edits", async () => {
    const user = userEvent.setup()
    const i18n = createAppI18n({ initialLocale: "en", storage: null })
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <I18nextProvider i18n={i18n}>
        <RolePresetDialog preset={PRODUCT_MANAGER} onClose={() => undefined} onSave={onSave} />
      </I18nextProvider>,
    )

    await act(() => i18n.changeLanguage("zh-CN"))
    expect(screen.getByLabelText("名称")).toHaveValue("产品经理")

    await user.click(screen.getByRole("button", { name: "保存预设" }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledOnce()
    })
    expect(onSave).toHaveBeenCalledWith({
      name: PRODUCT_MANAGER.name,
      category: PRODUCT_MANAGER.category,
      description: PRODUCT_MANAGER.description,
      agent: PRODUCT_MANAGER.agent,
      systemPrompt: PRODUCT_MANAGER.systemPrompt,
    })
  })
})

const PRODUCT_MANAGER: RolePreset = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Product manager",
  description: "Turns an idea into clear requirements, priorities, and an execution plan.",
  category: "Planning",
  agent: "codex",
  systemPrompt: "canonical-product-manager-system-prompt",
  builtIn: true,
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
}
