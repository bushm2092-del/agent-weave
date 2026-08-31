import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AssetUrlsProvider, TldrawUiTranslationProvider, type TLUiAssetUrls, useTranslation } from "tldraw"

import { TLDRAW_UI_OVERRIDES } from "./tldraw"

const jsonDataUrl = (value: object) =>
  `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(value))}`

const assetUrls = {
  fonts: {},
  icons: {},
  embedIcons: {},
  translations: {
    en: jsonDataUrl({}),
    "zh-cn": jsonDataUrl({}),
  },
} as unknown as TLUiAssetUrls

function TranslationProbe() {
  const translate = useTranslation()
  return <output>{translate("comments.link-copied")}</output>
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("tldraw translation overrides", () => {
  it("resolves the missing zh-cn comment-link toast to the app override while English stays upstream", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined)

    const { rerender } = render(
      <AssetUrlsProvider assetUrls={assetUrls}>
        <TldrawUiTranslationProvider locale="zh-cn" overrides={TLDRAW_UI_OVERRIDES.translations}>
          <TranslationProbe />
        </TldrawUiTranslationProvider>
      </AssetUrlsProvider>,
    )

    expect(await screen.findByText("链接已复制")).toBeInTheDocument()

    rerender(
      <AssetUrlsProvider assetUrls={assetUrls}>
        <TldrawUiTranslationProvider locale="en" overrides={TLDRAW_UI_OVERRIDES.translations}>
          <TranslationProbe />
        </TldrawUiTranslationProvider>
      </AssetUrlsProvider>,
    )

    expect(await screen.findByText("Link copied")).toBeInTheDocument()
  })
})
