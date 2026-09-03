import { beforeEach, describe, expect, it } from "vitest"

import { LOCALE_STORAGE_KEY } from "./locale"
import { appI18n, createAppI18n, setAppLocale } from "./i18n"

describe("application i18next lifecycle", () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = "en"
  })

  it("prefers a stored locale over the system locale before rendering", async () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, "en")

    const i18n = await createAppI18n({ systemLanguages: ["zh-CN"] })

    expect(i18n.language).toBe("en")
    expect(document.documentElement.lang).toBe("en")
  })

  it("uses the system locale when no stored locale exists", async () => {
    const i18n = await createAppI18n({ systemLanguages: ["zh-Hans-CN", "en-US"] })

    expect(i18n.language).toBe("zh-CN")
    expect(document.documentElement.lang).toBe("zh-CN")
  })

  it("falls back to English for a key missing from the active language", async () => {
    const i18n = await createAppI18n({ initialLocale: "zh-CN" })
    const zhCNResources = i18n.getResourceBundle("zh-CN", "translation")
    i18n.removeResourceBundle("zh-CN", "translation")

    try {
      expect(i18n.t("common.save")).toBe("Save")
    } finally {
      i18n.addResourceBundle("zh-CN", "translation", zhCNResources, true, true)
    }
  })

  it("changes language immediately and synchronizes the document language", async () => {
    const i18n = await createAppI18n({ initialLocale: "en" })

    await i18n.changeLanguage("zh-CN")

    expect(i18n.t("common.save")).toBe("保存")
    expect(document.documentElement.lang).toBe("zh-CN")
  })

  it("persists explicit global locale changes", async () => {
    await setAppLocale("zh-CN")

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh-CN")
    expect(document.documentElement.lang).toBe("zh-CN")
  })

  it("respects explicit null storage without reading the browser storage getter", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage")
    let getterCalls = 0
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        getterCalls += 1
        throw new Error("blocked getter")
      },
    })

    try {
      expect(() => createAppI18n({ initialLocale: "en", storage: null })).not.toThrow()
      expect(getterCalls).toBe(0)
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor)
    }
  })

  it("boots and completes language changes when browser storage access is blocked", async () => {
    await setAppLocale("en")
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage")
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked getter")
      },
    })

    try {
      expect(() => createAppI18n({ initialLocale: "en" })).not.toThrow()
      await expect(setAppLocale("zh-CN")).resolves.toBeUndefined()
      expect(appI18n.language).toBe("zh-CN")
      expect(document.documentElement.lang).toBe("zh-CN")
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor)
    }
  })

  it("completes language changes when persisting the preference fails", async () => {
    await setAppLocale("en")
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage")
    const restrictedStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked write")
      },
    } as unknown as Storage
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: restrictedStorage,
    })

    try {
      await expect(setAppLocale("zh-CN")).resolves.toBeUndefined()
      expect(appI18n.language).toBe("zh-CN")
      expect(document.documentElement.lang).toBe("zh-CN")
    } finally {
      if (descriptor) Object.defineProperty(window, "localStorage", descriptor)
    }
  })
})
