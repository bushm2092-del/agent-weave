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

  it("uses the system preference by default and keeps full language names in the menu", async () => {
    const user = userEvent.setup()
    const i18n = createAppI18n({ initialLocale: "en", storage: null })

    render(
      <I18nextProvider i18n={i18n}>
        <LanguageSwitcher />
      </I18nextProvider>,
    )

    const trigger = screen.getByRole("combobox", { name: "Language" })
    expect(trigger).toHaveTextContent("System · EN")

    await user.click(trigger)
    expect(await screen.findByRole("option", { name: "Follow system language" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(screen.getByRole("option", { name: "English" })).toHaveAttribute("aria-selected", "false")
    expect(screen.getByRole("option", { name: "简体中文" })).toHaveAttribute("aria-selected", "false")
  })

  it("switches to Simplified Chinese and persists the manual override", async () => {
    const user = userEvent.setup()
    const i18n = createAppI18n({ initialLocale: "en", storage: null })

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

  it("returns to the system language and clears the manual override", async () => {
    const user = userEvent.setup()
    const restoreLanguages = mockSystemLanguages(["zh-CN", "en-US"])
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en")
    const i18n = createAppI18n({ systemLanguages: ["zh-CN", "en-US"] })

    try {
      render(
        <I18nextProvider i18n={i18n}>
          <LanguageSwitcher />
        </I18nextProvider>,
      )

      await user.click(screen.getByRole("combobox", { name: "Language" }))
      await user.click(await screen.findByRole("option", { name: "Follow system language" }))

      await waitFor(() => {
        expect(i18n.language).toBe("zh-CN")
        expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
        expect(screen.getByRole("combobox", { name: "语言" })).toHaveTextContent("系统 · 中文")
      })
    } finally {
      restoreLanguages()
    }
  })

  it("tracks system language changes while the system preference is active", async () => {
    let languages: readonly string[] = ["en-US"]
    const restoreLanguages = mockSystemLanguages(() => languages)
    const i18n = createAppI18n({ initialLocale: "en", storage: null })

    try {
      render(
        <I18nextProvider i18n={i18n}>
          <LanguageSwitcher />
        </I18nextProvider>,
      )

      languages = ["zh-CN", "en-US"]
      window.dispatchEvent(new Event("languagechange"))

      await waitFor(() => {
        expect(i18n.language).toBe("zh-CN")
        expect(screen.getByRole("combobox", { name: "语言" })).toHaveTextContent("系统 · 中文")
      })
    } finally {
      restoreLanguages()
    }
  })

  it("keeps a manual override when the system language changes", async () => {
    let languages: readonly string[] = ["en-US"]
    const restoreLanguages = mockSystemLanguages(() => languages)
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en")
    const i18n = createAppI18n({ systemLanguages: languages })

    try {
      render(
        <I18nextProvider i18n={i18n}>
          <LanguageSwitcher />
        </I18nextProvider>,
      )

      languages = ["zh-CN", "en-US"]
      window.dispatchEvent(new Event("languagechange"))

      await waitFor(() => {
        expect(i18n.language).toBe("en")
        expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("en")
        expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("EN")
      })
    } finally {
      restoreLanguages()
    }
  })
})

function mockSystemLanguages(value: readonly string[] | (() => readonly string[])): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(navigator, "languages")
  Object.defineProperty(navigator, "languages", {
    configurable: true,
    get: typeof value === "function" ? value : () => value,
  })
  return () => {
    if (descriptor) Object.defineProperty(navigator, "languages", descriptor)
    else Reflect.deleteProperty(navigator, "languages")
  }
}
