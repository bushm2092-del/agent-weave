import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"

import { createAppI18n } from "@/i18n"

import { TokenDebuggerPage } from "./token-debugger-page"

describe("TokenDebuggerPage prompt sample", () => {
  it("updates a pristine sample without remounting and preserves dirty user input", async () => {
    const user = userEvent.setup()
    const i18n = createAppI18n({ initialLocale: "en", storage: null })
    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <TokenDebuggerPage />
        </MemoryRouter>
      </I18nextProvider>,
    )

    const prompt = screen.getByRole("textbox", { name: "Creative brief" })
    expect(prompt).toHaveValue("Create a minimal campaign system for an agentic workspace.")

    await act(() => i18n.changeLanguage("zh-CN"))

    await waitFor(() => expect(prompt).toHaveValue("为智能体工作区创建一套简洁的营销活动系统。"))
    expect(screen.getByRole("textbox", { name: "创意简报" })).toBe(prompt)

    await user.clear(prompt)
    await user.type(prompt, "Keep this exact user-authored prompt, trace=7.")
    await act(() => i18n.changeLanguage("en"))

    expect(screen.getByRole("textbox", { name: "Creative brief" })).toBe(prompt)
    expect(prompt).toHaveValue("Keep this exact user-authored prompt, trace=7.")
  })
})
