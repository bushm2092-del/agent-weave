import { describe, expect, it } from "vitest"

import {
  detectSystemLocale,
  loadStoredLocale,
  normalizeLocale,
  resolveLocalePreference,
  saveLocale,
  saveLocalePreference,
} from "./locale"

function storageWith(key: string, value: string): Storage {
  const storage = new Map([[key, value]])

  return {
    get length() {
      return storage.size
    },
    clear: () => storage.clear(),
    getItem: (itemKey) => storage.get(itemKey) ?? null,
    key: (index) => [...storage.keys()][index] ?? null,
    removeItem: (itemKey) => storage.delete(itemKey),
    setItem: (itemKey, itemValue) => storage.set(itemKey, itemValue),
  }
}

describe("locale policy", () => {
  it.each([
    ["zh-CN", "zh-CN"],
    ["zh-TW", "zh-CN"],
    ["fr-FR", "en"],
  ] as const)("normalizes %s to %s", (value, expected) => {
    expect(normalizeLocale(value)).toBe(expected)
  })

  it("detects Chinese from the system language priority list", () => {
    expect(detectSystemLocale(["zh-Hans-CN", "en-US"])).toBe("zh-CN")
  })

  it("resolves system and explicit locale preferences", () => {
    expect(resolveLocalePreference("system", ["zh-Hans-CN", "en-US"])).toBe("zh-CN")
    expect(resolveLocalePreference("en", ["zh-CN"])).toBe("en")
  })

  it.each([
    [["fr-FR", "en-US", "zh-CN"], "en"],
    [["fr-FR", "zh-Hans-CN", "en-US"], "zh-CN"],
    [["fr-FR", "ja-JP"], "en"],
  ] as const)("selects the first supported locale from %j", (languages, expected) => {
    expect(detectSystemLocale(languages)).toBe(expected)
  })

  it("loads a valid stored locale", () => {
    expect(loadStoredLocale(storageWith("agent-weave:locale", "en"))).toBe("en")
  })

  it("ignores an invalid stored locale", () => {
    expect(loadStoredLocale(storageWith("agent-weave:locale", "invalid"))).toBeUndefined()
  })

  it("treats missing or restricted storage as an absent preference", () => {
    const restrictedStorage = storageWith("", "")
    restrictedStorage.getItem = () => {
      throw new Error("blocked")
    }

    expect(loadStoredLocale(null)).toBeUndefined()
    expect(loadStoredLocale(undefined)).toBeUndefined()
    expect(loadStoredLocale(restrictedStorage)).toBeUndefined()
  })

  it("saves a locale without propagating storage failures", () => {
    const storage = storageWith("", "")

    saveLocale(storage, "zh-CN")

    expect(storage.getItem("agent-weave:locale")).toBe("zh-CN")
    const restrictedStorage = storageWith("", "")
    restrictedStorage.setItem = () => {
      throw new Error("blocked")
    }

    expect(() => saveLocale(restrictedStorage, "en")).not.toThrow()
  })

  it("removes the manual override when returning to the system preference", () => {
    const storage = storageWith("agent-weave:locale", "en")

    saveLocalePreference(storage, "system")

    expect(storage.getItem("agent-weave:locale")).toBeNull()
    const restrictedStorage = storageWith("agent-weave:locale", "en")
    restrictedStorage.removeItem = () => {
      throw new Error("blocked")
    }
    expect(() => saveLocalePreference(restrictedStorage, "system")).not.toThrow()
  })
})
