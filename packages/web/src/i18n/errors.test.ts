import { describe, expect, it } from "vitest"

import { ApiClientError } from "@/lib/api"

import { localizeError, ownedErrorPresentation, toErrorPresentation } from "./errors"
import { createAppI18n } from "./i18n"

describe("localizeError", () => {
  it.each([
    ["en", "Unable to reach the AgentWeave server."],
    ["zh-CN", "无法连接到 AgentWeave 服务器。"],
  ] as const)("maps a known API error code in %s", (locale, expected) => {
    const i18n = createAppI18n({ initialLocale: locale, storage: null })
    const error = new ApiClientError({ code: "NETWORK_ERROR", message: "raw network copy" })

    expect(localizeError(error, i18n.t, "errors.generic")).toBe(expected)
  })

  it.each(["en", "zh-CN"] as const)("preserves an unknown provider message verbatim in %s", (locale) => {
    const i18n = createAppI18n({ initialLocale: locale, storage: null })
    const rawMessage = "Provider said: model foobar-v9 is unavailable [trace=abc123]"
    const error = new ApiClientError({ code: "PROVIDER_OPAQUE_ERROR", message: rawMessage })

    expect(localizeError(error, i18n.t, "errors.generic")).toBe(rawMessage)
  })

  it.each([
    ["ACP_SESSION_INIT_FAILED", "ACP session failed: provider handshake rejected [trace=session-42]"],
    ["ACP_BACKEND_MISSING", "ACP backend binary missing at /opt/vendor/acp"],
    ["ACP_BACKEND_UNAVAILABLE", "ACP backend unavailable: upstream socket closed"],
  ] as const)("preserves external %s diagnostics verbatim in both locales", (code, rawMessage) => {
    const error = new ApiClientError({ code, message: rawMessage })
    const en = createAppI18n({ initialLocale: "en", storage: null })
    const zhCN = createAppI18n({ initialLocale: "zh-CN", storage: null })

    expect(localizeError(error, en.t, "errors.generic")).toBe(rawMessage)
    expect(localizeError(error, zhCN.t, "errors.generic")).toBe(rawMessage)
  })

  it("uses the localized fallback only when no error message exists", () => {
    const i18n = createAppI18n({ initialLocale: "zh-CN", storage: null })

    expect(localizeError({ reason: "no Error instance" }, i18n.t, "errors.loadFailed")).toBe("无法加载数据。")
  })
})

// These compile-time assertions prevent owned error descriptors from silently
// accepting misspelled translation resource keys.
ownedErrorPresentation("canvas.errors.readFile")
toErrorPresentation(new Error("failure"), "errors.fallbacks.loadCanvas")
// @ts-expect-error misspelled owned resource key
ownedErrorPresentation("canvas.errors.readFil")
// @ts-expect-error misspelled fallback resource key
toErrorPresentation(new Error("failure"), "errors.fallbacks.loadCanva")
