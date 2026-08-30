import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createAppI18n } from "@/i18n"

import { PromptComposer } from "./prompt-composer"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("PromptComposer image read errors", () => {
  it("shows and relocalizes the owned fallback without reading the file again", async () => {
    const readAsDataURL = installFailingFileReader(null)
    const i18n = createAppI18n({ initialLocale: "en", storage: null })
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <PromptComposer conversationId="conversation-owned-read-error" disabled={false} />
      </I18nextProvider>,
    )

    uploadImage(container, "wireframe.png")

    expect(await screen.findByText("Unable to read the image.")).toBeInTheDocument()
    expect(readAsDataURL).toHaveBeenCalledTimes(1)

    await act(() => i18n.changeLanguage("zh-CN"))

    expect(screen.getByText("无法读取图片。")).toBeInTheDocument()
    expect(readAsDataURL).toHaveBeenCalledTimes(1)
  })

  it("keeps a native opaque FileReader message byte-for-byte across locale changes", async () => {
    const rawMessage = "Native reader: encrypted image [trace=file-7]"
    const readAsDataURL = installFailingFileReader(new DOMException(rawMessage, "NotReadableError"))
    const i18n = createAppI18n({ initialLocale: "en", storage: null })
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <PromptComposer conversationId="conversation-native-read-error" disabled={false} />
      </I18nextProvider>,
    )

    uploadImage(container, "encrypted.png")

    expect(await screen.findByText(rawMessage)).toBeInTheDocument()
    await act(() => i18n.changeLanguage("zh-CN"))
    expect(screen.getByText(rawMessage)).toBeInTheDocument()
    expect(readAsDataURL).toHaveBeenCalledTimes(1)
  })
})

function installFailingFileReader(error: DOMException | null) {
  const readAsDataURL = vi.fn(function (this: FileReader) {
    this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>)
  })
  vi.stubGlobal(
    "FileReader",
    class {
      error = error
      onerror: FileReader["onerror"] = null
      onload: FileReader["onload"] = null
      result: FileReader["result"] = null
      readAsDataURL = readAsDataURL
    },
  )
  return readAsDataURL
}

function uploadImage(container: HTMLElement, name: string): void {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error("Expected PromptComposer image input.")
  fireEvent.change(input, {
    target: { files: [new File(["broken image"], name, { type: "image/png" })] },
  })
}
