import type { Team } from "@agent-weave/contracts"
import { act, cleanup, render, screen } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"
import type { Editor } from "tldraw"
import { afterEach, describe, expect, it } from "vitest"

import { createAppI18n } from "@/i18n"
import { teamStore } from "@/features/teams/store"

import { TeamHeader } from "./team-header"

const TEAM_ID = "00000000-0000-4000-8000-000000000001"
const NOW = "2026-08-30T00:00:00.000Z"
const editor = { markEventAsHandled: () => undefined } as unknown as Editor

afterEach(() => {
  cleanup()
  teamStore.getState().remove(TEAM_ID)
})

describe("TeamHeader task count localization", () => {
  it.each([
    [1, 1, "1/1 task", "1/1 个任务"],
    [2, 1, "1/2 tasks", "1/2 个任务"],
    [1000, 1000, "1,000/1,000 tasks", "1,000/1,000 个任务"],
  ] as const)("formats %i total tasks using raw plural selection", async (total, completed, expectedEn, expectedZh) => {
    teamStore.getState().prepareReplay(makeTeam(total, completed))
    const i18n = createAppI18n({ initialLocale: "en", storage: null })

    render(
      <I18nextProvider i18n={i18n}>
        <TeamHeader editor={editor} teamId={TEAM_ID} fallbackName="Fallback team" />
      </I18nextProvider>,
    )

    const summary = screen.getByText(
      (_, element) => element?.tagName === "SPAN" && element.textContent?.includes("Shared workspace") === true,
    )
    expect(summary.textContent).toMatch(new RegExp(`${expectedEn} · Shared workspace$`))
    await act(() => i18n.changeLanguage("zh-CN"))
    expect(summary.textContent).toMatch(new RegExp(`${expectedZh} · 共享工作区$`))
  })
})

function makeTeam(total: number, completed: number): Team {
  return {
    id: TEAM_ID,
    canvasId: "canvas-task-count",
    name: "Apollo team",
    workspace: "/workspace/apollo",
    leaderSlotId: "00000000-0000-4000-8000-000000000002",
    sessionStatus: "ready",
    members: [],
    tasks: Array.from({ length: total }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      teamId: TEAM_ID,
      subject: `Task ${index}`,
      description: "User task description",
      status: index < completed ? "completed" : "pending",
      blockedBy: [],
      createdAt: NOW,
      updatedAt: NOW,
    })),
    spawnRequests: [],
    createdAt: NOW,
    updatedAt: NOW,
  }
}
