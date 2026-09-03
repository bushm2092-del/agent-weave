import { I18nextProvider, useTranslation } from "react-i18next"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"

import { useCanvasStore } from "@/features/canvases"
import { ApiClientError } from "@/lib/api"

import {
  localizeErrorPresentation,
  ownedErrorPresentation,
  toErrorPresentation,
  type ErrorPresentation,
} from "./errors"
import { createAppI18n } from "./i18n"

afterEach(() => {
  cleanup()
  useCanvasStore.getState().setError(undefined)
})

describe("reactive error presentation", () => {
  it("relocalizes a known error kept in React state without another request", async () => {
    const rawError = new ApiClientError({ code: "NETWORK_ERROR", message: "raw network copy" })
    const presentation = toErrorPresentation(rawError, "errors.generic")
    const i18n = createAppI18n({ initialLocale: "en", storage: null })

    render(
      <I18nextProvider i18n={i18n}>
        <LocalStateHarness error={presentation} />
      </I18nextProvider>,
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to reach the AgentWeave server.")
    await userEvent.click(screen.getByRole("button", { name: "switch locale" }))
    expect(screen.getByRole("alert")).toHaveTextContent("无法连接到 AgentWeave 服务器。")
    expect(presentation).toMatchObject({ code: "NETWORK_ERROR", message: "raw network copy" })
  })

  it("relocalizes a client-owned protocol error without reconnecting", async () => {
    const presentation = ownedErrorPresentation("errors.client.teamEventMalformed")
    const i18n = createAppI18n({ initialLocale: "en", storage: null })

    render(
      <I18nextProvider i18n={i18n}>
        <LocalStateHarness error={presentation} />
      </I18nextProvider>,
    )

    expect(screen.getByRole("alert")).toHaveTextContent("The server sent malformed team event data.")
    await userEvent.click(screen.getByRole("button", { name: "switch locale" }))
    expect(screen.getByRole("alert")).toHaveTextContent("服务器发送的团队事件数据格式错误。")
  })

  it("keeps an unknown external error byte-for-byte identical after a locale switch", async () => {
    const rawMessage = "Provider said: 模型 foo/bar unavailable [trace=raw-9]"
    const presentation = toErrorPresentation(
      new ApiClientError({ code: "PROVIDER_OPAQUE_ERROR", message: rawMessage }),
      "errors.generic",
    )
    const i18n = createAppI18n({ initialLocale: "en", storage: null })

    render(
      <I18nextProvider i18n={i18n}>
        <LocalStateHarness error={presentation} />
      </I18nextProvider>,
    )

    expect(screen.getByRole("alert")).toHaveTextContent(rawMessage)
    await userEvent.click(screen.getByRole("button", { name: "switch locale" }))
    expect(screen.getByRole("alert")).toHaveTextContent(rawMessage)
  })

  it("relocalizes a known error retained in the Canvas Zustand store", async () => {
    const presentation = toErrorPresentation(
      new ApiClientError({ code: "NETWORK_ERROR", message: "raw store network copy" }),
      "errors.fallbacks.loadCanvases",
    )
    useCanvasStore.getState().setError(presentation)
    const i18n = createAppI18n({ initialLocale: "en", storage: null })

    render(
      <I18nextProvider i18n={i18n}>
        <CanvasStoreHarness />
      </I18nextProvider>,
    )

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to reach the AgentWeave server.")
    await userEvent.click(screen.getByRole("button", { name: "switch locale" }))
    expect(screen.getByRole("alert")).toHaveTextContent("无法连接到 AgentWeave 服务器。")
    expect(useCanvasStore.getState().error).toBe(presentation)
  })
})

function LocalStateHarness({ error }: { error: ErrorPresentation }) {
  const [storedError] = useState(error)
  const { i18n, t } = useTranslation()
  return (
    <>
      <div role="alert">{localizeErrorPresentation(storedError, t)}</div>
      <button type="button" onClick={() => void i18n.changeLanguage("zh-CN")}>
        switch locale
      </button>
    </>
  )
}

function CanvasStoreHarness() {
  const storedError = useCanvasStore((state) => state.error)
  const { i18n, t } = useTranslation()
  return (
    <>
      <div role="alert">{localizeErrorPresentation(storedError, t)}</div>
      <button type="button" onClick={() => void i18n.changeLanguage("zh-CN")}>
        switch locale
      </button>
    </>
  )
}
