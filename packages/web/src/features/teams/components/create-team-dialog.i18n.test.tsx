import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import { afterEach, describe, expect, it, vi } from "vitest"

import { rolePresetApi } from "@/features/role-presets"
import { createAppI18n } from "@/i18n"

import { CreateTeamDialog } from "./create-team-dialog"

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("CreateTeamDialog localization", () => {
  it("updates mounted dialog copy while preserving a user-entered team name", async () => {
    const user = userEvent.setup()
    const i18n = createAppI18n({ initialLocale: "en", storage: null })
    vi.spyOn(rolePresetApi, "list").mockResolvedValue([])

    render(
      <I18nextProvider i18n={i18n}>
        <CreateTeamDialog onClose={() => undefined} onCreate={vi.fn()} />
      </I18nextProvider>,
    )

    const name = screen.getByRole("textbox", { name: "Team name" })
    await user.clear(name)
    await user.type(name, "Apollo launch crew")
    expect(screen.getByRole("heading", { name: "New agent team" })).toBeInTheDocument()

    await act(() => i18n.changeLanguage("zh-CN"))

    expect(screen.getByRole("heading", { name: "新建智能体团队" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "团队名称" })).toHaveValue("Apollo launch crew")
    expect(screen.getByText("还没有队友，负责人可以稍后添加。")).toBeInTheDocument()
  })
})
