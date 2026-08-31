import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { formatNumber, formatRelativeTime, formatTime } from "./format"
import { appI18n } from "./i18n"

describe("locale formatters", () => {
  beforeEach(async () => {
    await appI18n.changeLanguage("en")
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("formats numbers in the requested locale", () => {
    expect(formatNumber(1234567.89, "en")).toBe("1,234,567.89")
    expect(formatNumber(1234567.89, "zh-CN")).toBe("1,234,567.89")
  })

  it("formats timestamps in the requested locale", () => {
    const timestamp = new Date(2026, 0, 2, 3, 4)

    expect(formatTime(timestamp, "en")).toBe("Jan 2, 2026, 3:04 AM")
    expect(formatTime(timestamp, "zh-CN")).toBe("2026年1月2日 03:04")
  })

  it("formats relative time in English and Simplified Chinese", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 2, 3, 4))
    const threeMinutesAgo = new Date(2026, 0, 2, 3, 1)

    expect(formatRelativeTime(threeMinutesAgo, "en")).toBe("3 minutes ago")
    expect(formatRelativeTime(threeMinutesAgo, "zh-CN")).toBe("3分钟前")
  })

  it("uses the active global locale when no locale is passed", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 2, 3, 4))
    const timestamp = new Date(2026, 0, 2, 3, 4)
    const threeMinutesFromNow = new Date(2026, 0, 2, 3, 7)
    const oneMinuteFromNow = new Date(2026, 0, 2, 3, 5)

    await appI18n.changeLanguage("zh-CN")

    expect(formatNumber(1234567.89)).toBe("1,234,567.89")
    expect(formatTime(timestamp)).toBe("2026年1月2日 03:04")
    expect(formatRelativeTime(threeMinutesFromNow)).toBe("3分钟后")
    expect(formatRelativeTime(oneMinuteFromNow)).toBe("1分钟后")

    await appI18n.changeLanguage("en")

    expect(formatNumber(1234567.89)).toBe("1,234,567.89")
    expect(formatTime(timestamp)).toBe("Jan 2, 2026, 3:04 AM")
    expect(formatRelativeTime(threeMinutesFromNow)).toBe("in 3 minutes")
  })
})
