import type { CanvasSummary } from "@agent-weave/contracts"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { canvasApi, canvasController, useCanvasStore } from "@/features/canvases"
import { rolePresetApi } from "@/features/role-presets"
import { createAppI18n } from "@/i18n"
import { TooltipProvider } from "@/components/ui/tooltip"

import { HomePage } from "./home-page"

const USER_CANVAS_NAME = "Q3 launch plan"

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches: false,
      removeEventListener: vi.fn(),
    }),
  })
  useCanvasStore.getState().setCanvases([CANVAS])
  useCanvasStore.getState().setLoading(false)
  useCanvasStore.getState().setError(undefined)
  vi.spyOn(canvasController, "load").mockResolvedValue([CANVAS])
  vi.spyOn(rolePresetApi, "list").mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("HomePage localization", () => {
  it("updates the mounted workspace header while preserving a user canvas name", async () => {
    const i18n = createAppI18n({ initialLocale: "en", storage: null })
    render(
      <I18nextProvider i18n={i18n}>
        <TooltipProvider>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </TooltipProvider>
      </I18nextProvider>,
    )

    expect(screen.getByRole("heading", { name: "Your canvases" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: USER_CANVAS_NAME })).toBeInTheDocument()
    expect(screen.getByText("1 canvas")).toBeInTheDocument()

    await act(() => i18n.changeLanguage("zh-CN"))

    expect(screen.getByRole("heading", { name: "你的画布" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: USER_CANVAS_NAME })).toBeInTheDocument()
  })

  it.each([
    [1, "1 canvas"],
    [2, "2 canvases"],
    [1000, "1,000 canvases"],
  ] as const)("formats a total of %i canvases with the English plural category", async (count, expected) => {
    const canvases = Array.from({ length: count }, (_, index) => ({
      ...CANVAS,
      id: `canvas-${index}`,
      name: `Canvas ${index}`,
    }))
    useCanvasStore.getState().setCanvases(canvases)
    vi.mocked(canvasController.load).mockResolvedValue(canvases)
    const i18n = createAppI18n({ initialLocale: "en", storage: null })

    render(
      <I18nextProvider i18n={i18n}>
        <TooltipProvider>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </TooltipProvider>
      </I18nextProvider>,
    )

    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it("creates a default canvas in the current locale and never rewrites its saved name", async () => {
    const user = userEvent.setup()
    const createdCanvas: CanvasSummary = {
      ...CANVAS,
      id: "canvas-created-after-switch",
      name: "未命名画布",
    }
    const create = vi.spyOn(canvasApi, "create").mockResolvedValue(createdCanvas)
    const i18n = createAppI18n({ initialLocale: "en", storage: null })
    render(
      <I18nextProvider i18n={i18n}>
        <TooltipProvider>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </TooltipProvider>
      </I18nextProvider>,
    )

    await act(() => i18n.changeLanguage("zh-CN"))
    await user.click(screen.getAllByRole("button", { name: "新建画布" })[0]!)

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        name: "未命名画布",
        description: "",
        accent: "blue",
      }),
    )
    expect(useCanvasStore.getState().canvases.find((canvas) => canvas.id === createdCanvas.id)?.name).toBe("未命名画布")

    await act(() => i18n.changeLanguage("en"))

    expect(useCanvasStore.getState().canvases.find((canvas) => canvas.id === createdCanvas.id)?.name).toBe("未命名画布")
  })
})

const CANVAS: CanvasSummary = {
  id: "canvas-user-name",
  name: USER_CANVAS_NAME,
  description: "",
  accent: "blue",
  agents: 2,
  teams: 1,
  thumbnailDataUrl: null,
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
}
