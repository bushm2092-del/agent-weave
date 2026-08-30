import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import type { ComponentType } from "react"
import { MemoryRouter, Route, Routes } from "react-router"
import { afterEach, describe, expect, it, vi } from "vitest"

import { canvasApi, canvasController } from "@/features/canvases"
import { teamApi, teamController } from "@/features/teams"
import { createAppI18n } from "@/i18n"

import { CanvasPage, toTldrawLocale } from "./canvas-page"

type TldrawTranslationOverrides = {
  translations?: Record<string, Record<string, string>>
}

const tldrawHarness = vi.hoisted(() => ({
  editor: null as object | null,
  overrides: null as TldrawTranslationOverrides | null,
}))

vi.mock("@/features/canvas/canvas-toolbar", () => ({
  CanvasToolbar: ({ onCreateFilePreview }: { onCreateFilePreview: (editor: object) => void }) => (
    <button type="button" onClick={() => onCreateFilePreview({})}>
      New file preview
    </button>
  ),
}))

vi.mock("tldraw", async (importOriginal) => {
  const actual = await importOriginal<typeof import("tldraw")>()
  const { useEffect } = await import("react")
  return {
    ...actual,
    Tldraw: ({
      components,
      onMount,
      overrides,
    }: {
      components?: { Toolbar?: ComponentType }
      onMount?: (editor: object) => void
      overrides?: TldrawTranslationOverrides
    }) => {
      const Toolbar = components?.Toolbar
      tldrawHarness.overrides = overrides ?? null
      useEffect(() => {
        if (tldrawHarness.editor) {
          onMount?.(tldrawHarness.editor)
        }
      }, [onMount])
      return <div data-testid="whiteboard">{Toolbar && <Toolbar />}</div>
    },
    useValue: (_name: string, getter: () => unknown) => getter(),
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  tldrawHarness.editor = null
  tldrawHarness.overrides = null
})

describe("CanvasPage localization", () => {
  it.each([
    ["en", "en"],
    ["zh-CN", "zh-cn"],
  ] as const)("maps the %s app locale to the %s tldraw locale", (locale, expected) => {
    expect(toTldrawLocale(locale)).toBe(expected)
  })

  it("synchronizes the mounted tldraw editor locale without remounting it", async () => {
    const canvasId = "canvas-locale-sync"
    const fakeEditor = createMemberDeleteEditor({
      memberId: "shape-locale-sync",
      slotId: "slot-locale-sync",
      teamId: "team-locale-sync",
    })
    tldrawHarness.editor = fakeEditor.editor
    vi.spyOn(canvasController, "get").mockResolvedValue({
      id: canvasId,
      name: "Launch board",
      description: "",
      accent: "blue",
      agents: 0,
      teams: 0,
      thumbnailDataUrl: null,
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt: "2026-08-30T00:00:00.000Z",
    })
    vi.spyOn(canvasApi, "getSnapshot").mockResolvedValue({
      canvasId,
      document: null,
      thumbnailDataUrl: null,
      updatedAt: null,
    })
    vi.spyOn(teamController, "loadCanvas").mockReturnValue(new Promise(() => undefined))
    const i18n = createAppI18n({ initialLocale: "en", storage: null })

    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[`/canvas/${canvasId}`]}>
          <Routes>
            <Route path="/canvas/:canvasId" element={<CanvasPage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>,
    )

    await waitFor(() => expect(fakeEditor.updateUserPreferences).toHaveBeenLastCalledWith({ locale: "en" }))
    expect(tldrawHarness.overrides).toEqual({
      translations: {
        "zh-cn": {
          "comments.link-copied": "链接已复制",
        },
      },
    })
    expect(tldrawHarness.overrides?.translations?.en).toBeUndefined()
    const whiteboard = screen.getByTestId("whiteboard")

    await act(() => i18n.changeLanguage("zh-CN"))

    await waitFor(() => expect(fakeEditor.updateUserPreferences).toHaveBeenLastCalledWith({ locale: "zh-cn" }))
    expect(screen.getByTestId("whiteboard")).toBe(whiteboard)
  })

  it("updates the mounted canvas header while preserving its persisted name", async () => {
    const i18n = createAppI18n({ initialLocale: "en", storage: null })
    vi.spyOn(canvasController, "get").mockResolvedValue({
      id: "canvas-persisted-name",
      name: "客户旅程图",
      description: "",
      accent: "blue",
      agents: 0,
      teams: 0,
      thumbnailDataUrl: null,
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt: "2026-08-30T00:00:00.000Z",
    })

    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/canvas/canvas-persisted-name"]}>
          <Routes>
            <Route path="/canvas/:canvasId" element={<CanvasPage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>,
    )

    const name = await screen.findByRole("textbox", { name: "Canvas name" })
    await waitFor(() => expect(name).toHaveValue("客户旅程图"))

    await act(() => i18n.changeLanguage("zh-CN"))

    expect(screen.getByRole("textbox", { name: "画布名称" })).toHaveValue("客户旅程图")
    expect(screen.getByRole("link", { name: "返回画布列表" })).toBeInTheDocument()
  })

  it("relocalizes an already-visible owned file-read error without another read", async () => {
    const i18n = createAppI18n({ initialLocale: "en", storage: null })
    vi.spyOn(canvasController, "get").mockResolvedValue({
      id: "canvas-owned-error",
      name: "Release board",
      description: "",
      accent: "blue",
      agents: 0,
      teams: 0,
      thumbnailDataUrl: null,
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt: "2026-08-30T00:00:00.000Z",
    })
    const readAsDataURL = vi.fn(function (this: FileReader) {
      this.onerror?.(new ProgressEvent("error") as ProgressEvent<FileReader>)
    })
    vi.stubGlobal(
      "FileReader",
      class {
        onerror: FileReader["onerror"] = null
        onload: FileReader["onload"] = null
        result: FileReader["result"] = null
        readAsDataURL = readAsDataURL
      },
    )
    vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (this: HTMLInputElement) {
      Object.defineProperty(this, "files", {
        configurable: true,
        value: [new File(["broken"], "Q4-计划.pdf", { type: "application/pdf" })],
      })
      this.onchange?.(new Event("change"))
    })

    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/canvas/canvas-owned-error"]}>
          <Routes>
            <Route path="/canvas/:canvasId" element={<CanvasPage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>,
    )

    await userEvent.click(screen.getByRole("button", { name: "New file preview" }))
    expect(screen.getByText("Unable to read Q4-计划.pdf.")).toBeInTheDocument()
    expect(readAsDataURL).toHaveBeenCalledTimes(1)

    await act(() => i18n.changeLanguage("zh-CN"))

    expect(screen.getByText("无法读取 Q4-计划.pdf。")).toBeInTheDocument()
    expect(readAsDataURL).toHaveBeenCalledTimes(1)
  })

  it("keeps a pending member deletion alive and guarded across a locale switch", async () => {
    const canvasId = "canvas-member-delete"
    const teamId = "team-member-delete"
    const memberId = "shape-member-delete"
    const slotId = "slot-member-delete"
    const originalRemoval = deferred<{ teamId: string; slotId: string; removed: boolean }>()
    const neverCompletes = new Promise<{ teamId: string; slotId: string; removed: boolean }>(() => undefined)
    const refreshedTeam = {
      id: teamId,
      canvasId,
      name: "Release team",
      workspace: "/workspace/release",
      leaderSlotId: "slot-leader",
      sessionStatus: "ready" as const,
      members: [],
      tasks: [],
      spawnRequests: [],
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt: "2026-08-30T00:00:00.000Z",
    }
    const fakeEditor = createMemberDeleteEditor({ memberId, slotId, teamId })
    tldrawHarness.editor = fakeEditor.editor
    vi.spyOn(canvasController, "get").mockResolvedValue({
      id: canvasId,
      name: "Release board",
      description: "",
      accent: "blue",
      agents: 1,
      teams: 1,
      thumbnailDataUrl: null,
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt: "2026-08-30T00:00:00.000Z",
    })
    vi.spyOn(canvasApi, "getSnapshot").mockResolvedValue({
      canvasId,
      document: null,
      thumbnailDataUrl: null,
      updatedAt: null,
    })
    vi.spyOn(teamController, "loadCanvas").mockReturnValue(new Promise(() => undefined))
    const removeMember = vi
      .spyOn(teamApi, "removeMember")
      .mockImplementationOnce(() => originalRemoval.promise)
      .mockImplementation(() => neverCompletes)
    const refresh = vi.spyOn(teamController, "refresh").mockResolvedValue(refreshedTeam)
    const i18n = createAppI18n({ initialLocale: "en", storage: null })

    render(
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[`/canvas/${canvasId}`]}>
          <Routes>
            <Route path="/canvas/:canvasId" element={<CanvasPage />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>,
    )

    await waitFor(() => expect(fakeEditor.isDeleteReady()).toBe(true))
    fakeEditor.attemptMemberDelete()
    await waitFor(() => expect(removeMember).toHaveBeenCalledTimes(1))

    await act(() => i18n.changeLanguage("zh-CN"))
    fakeEditor.attemptMemberDelete()
    originalRemoval.resolve({ teamId, slotId, removed: true })

    await waitFor(() => expect(refresh).toHaveBeenCalledWith(teamId))
    expect(removeMember).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(fakeEditor.hasMember()).toBe(false))
  })
})

type FakeShape = {
  id: string
  type: "agent" | "agent-team"
  parentId: string
  props: Record<string, string>
}

function createMemberDeleteEditor({ memberId, slotId, teamId }: { memberId: string; slotId: string; teamId: string }) {
  const teamShape: FakeShape = {
    id: "shape-team-delete",
    type: "agent-team",
    parentId: "page:page",
    props: { teamId, name: "Release team" },
  }
  const memberShape: FakeShape = {
    id: memberId,
    type: "agent",
    parentId: teamShape.id,
    props: {
      teamId,
      slotId,
      role: "teammate",
      conversationId: "conversation-member-delete",
      runner: "codex",
      model: "",
      workspace: "/workspace/release",
      title: "Builder",
    },
  }
  const shapes = new Map<string, FakeShape>([
    [teamShape.id, teamShape],
    [memberShape.id, memberShape],
  ])
  let beforeDelete: ((shape: FakeShape, source: string) => false | void) | undefined
  let afterDelete: ((shape: FakeShape, source: string) => void) | undefined
  const updateUserPreferences = vi.fn()
  const editor = {
    user: { updateUserPreferences },
    store: { listen: () => () => undefined },
    sideEffects: {
      registerBeforeDeleteHandler: (_type: string, handler: typeof beforeDelete) => {
        beforeDelete = handler
        return () => {
          if (beforeDelete === handler) beforeDelete = undefined
        }
      },
      registerBeforeChangeHandler: () => () => undefined,
      registerAfterCreateHandler: () => () => undefined,
      registerAfterDeleteHandler: (_type: string, handler: typeof afterDelete) => {
        afterDelete = handler
        return () => {
          if (afterDelete === handler) afterDelete = undefined
        }
      },
    },
    getSelectedShapes: () => [],
    getSelectedShapeIds: () => [],
    getSortedChildIdsForParent: () => [],
    getCurrentPageShapes: () => [...shapes.values()],
    getShape: (id: string) => shapes.get(id),
    updateShape: ({ id, props }: { id: string; props: Record<string, string> }) => {
      const shape = shapes.get(id)
      if (shape) shape.props = { ...shape.props, ...props }
    },
    run: (operation: () => void) => operation(),
    deleteShapes: (ids: string[]) => {
      ids.forEach((id) => {
        const shape = shapes.get(id)
        if (!shape || beforeDelete?.(shape, "user") === false) return
        shapes.delete(id)
        afterDelete?.(shape, "user")
      })
    },
  }
  return {
    editor,
    updateUserPreferences,
    attemptMemberDelete: () => editor.deleteShapes([memberId]),
    hasMember: () => shapes.has(memberId),
    isDeleteReady: () => beforeDelete !== undefined,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}
