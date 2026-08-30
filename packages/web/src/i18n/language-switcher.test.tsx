import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { LanguageSwitcher } from "./language-switcher"
import { createAppI18n } from "./i18n"
import { LOCALE_STORAGE_KEY } from "./locale"

describe("LanguageSwitcher", () => {
  afterEach(cleanup)

  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = "en"
  })

  it("uses compact labels while keeping full language names in the menu", async () => {
    const user = userEvent.setup()
    const i18n = createAppI18n({ initialLocale: "en" })

    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>,
    )

    const trigger = screen.getByRole("combobox", { name: "Language" })
    expect(trigger).toHaveTextContent("EN")
    expect(trigger).not.toHaveTextContent("English")

    await user.click(trigger)
    expect(await screen.findByRole("option", { name: "English" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("option", { name: "简体中文" })).toHaveAttribute("aria-selected", "false")
  })

  it("switches to Simplified Chinese and persists the global locale", async () => {
    const user = userEvent.setup()
    const i18n = createAppI18n({ initialLocale: "en" })

    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>,
    )

    await user.click(screen.getByRole("combobox", { name: "Language" }))
    await user.click(await screen.findByRole("option", { name: "简体中文" }))

    await screen.findByRole("combobox", { name: "语言" })
    expect(screen.getByRole("combobox", { name: "语言" })).toHaveTextContent("中文")
    await waitFor(() => {
      expect(i18n.language).toBe("zh-CN")
      expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh-CN")
      expect(document.documentElement.lang).toBe("zh-CN")
    })
  })
})
