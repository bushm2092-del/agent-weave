import { ArrowLeft, Plus, Settings, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { createShapeId, Tldraw, type Editor, type TLComponents, type TLShapeId, useValue } from "tldraw"
import "tldraw/tldraw.css"

import { Button } from "@/components/ui/button"
import { AgentComposer, type AgentDraft } from "@/features/canvas/agent-composer"
import { SelectionLayoutToolbar } from "@/features/canvas/layout"
import { AGENT_RUNNERS } from "@/features/canvas/agent-options"
import { AgentShapeUtil } from "@/features/canvas/shapes/agent"
import { AgentTeamShapeUtil } from "@/features/canvas/shapes/agent-team"
import { conversationApi, conversationController } from "@/features/conversations"
import { FileSidebar, useSingleSelectedAgent } from "@/features/files"
import {
  CreateTeamDialog,
  createTeamProjection,
  isProgrammaticTeamDelete,
  reconcileCanvasTeams,
  removeTeamProjection,
  syncCanvasTeams,
  syncTeamEventToCanvas,
  teamApi,
  teamController,
  teamStore,
  TeamInspector,
  type TeamDraft,
} from "@/features/teams"
import type { AgentTeamShape } from "@/features/canvas/shapes/agent-team"
import { ApiClientError } from "@/lib/api"
import { getWorkspace } from "@/pages/home/workspaces"
import { useWorkspaceStore } from "@/stores/workspace-store"

const shapeUtils = [AgentShapeUtil, AgentTeamShapeUtil]
const tldrawComponents: TLComponents = { StylePanel: null }

export function CanvasPage() {
  const { canvasId = "untitled" } = useParams()
  const [editor, setEditor] = useState<Editor | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [teamComposerOpen, setTeamComposerOpen] = useState(false)
  const selectedAgent = useSingleSelectedAgent(editor)
  const selectedTeam = useSingleSelectedTeam(editor)
  const fallbackName = getWorkspace(canvasId)?.name ?? "Untitled canvas"
  const canvasName = useWorkspaceStore((state) => state.canvasNames[canvasId] ?? fallbackName)
  const renameCanvas = useWorkspaceStore((state) => state.renameCanvas)

  useEffect(() => {
    if (!editor) return
    let active = true
    const historylessDeletes = new Set<TLShapeId>()
    const unregisterBeforeDelete = editor.sideEffects.registerBeforeDeleteHandler("shape", (shape, source) => {
      if (source === "remote" || isProgrammaticTeamDelete(shape.id) || historylessDeletes.has(shape.id)) return
      const isTeam = shape.type === "agent-team" && Boolean(shape.props.teamId)
      const isMember = shape.type === "agent" && Boolean(shape.props.teamId && shape.props.slotId)
      if (!isTeam && !isMember) return
      if (isMember && editor.getSelectedShapeIds().includes(shape.parentId as TLShapeId)) return false
      const ids = isTeam ? [shape.id, ...editor.getSortedChildIdsForParent(shape.id)] : [shape.id]
      ids.forEach((id) => historylessDeletes.add(id))
      queueMicrotask(() => {
        editor.run(() => editor.deleteShapes(ids), { history: "ignore" })
        queueMicrotask(() => ids.forEach((id) => historylessDeletes.delete(id)))
      })
      return false
    })
    const unregisterBeforeChange = editor.sideEffects.registerBeforeChangeHandler("shape", (previous, next, source) => {
      if (source !== "user" || previous.type !== "agent" || next.type !== "agent") return next
      const previousParent = editor.getShape(previous.parentId)
      const nextParent = editor.getShape(next.parentId)
      if (
        previous.props.teamId &&
        previousParent?.type === "agent-team" &&
        previousParent.props.teamId === previous.props.teamId &&
        next.parentId !== previous.parentId
      ) {
        return { ...next, parentId: previous.parentId, x: previous.x, y: previous.y }
      }
      if (!previous.props.teamId && nextParent?.type === "agent-team" && nextParent.props.teamId) return previous
      return next
    })
    const unregisterAfterCreate = editor.sideEffects.registerAfterCreateHandler("shape", (shape, source) => {
      if (source !== "remote" || shape.type !== "agent-team" || !shape.props.teamId) return
      void teamApi
        .get(shape.props.teamId)
        .then((team) => {
          if (team.canvasId === canvasId) teamController.prepare(team)
        })
        .catch(() => undefined)
    })
    const unregisterAfterDelete = editor.sideEffects.registerAfterDeleteHandler("shape", (shape, source) => {
      if (source === "remote") return
      if (isProgrammaticTeamDelete(shape.id)) return
      if (shape.type === "agent-team" && shape.props.teamId) {
        const teamId = shape.props.teamId
        const cachedTeam = teamStore.getState().teams[teamId]?.team
        removeTeamProjection(editor, teamId)
        void teamController.destroy(teamId).catch(async () => {
          if (!active) return
          const restorableTeam = teamStore.getState().teams[teamId]?.team ?? cachedTeam
          if (restorableTeam?.canvasId === canvasId) syncCanvasTeams(editor, [restorableTeam])
          try {
            const team = await teamController.refresh(teamId)
            if (!active) return
            if (team?.canvasId === canvasId) syncCanvasTeams(editor, [team])
            else removeTeamProjection(editor, teamId)
          } catch (refreshError) {
            if (!active || !isNotFound(refreshError)) return
            teamController.disconnect(teamId)
            teamStore.getState().remove(teamId)
            removeTeamProjection(editor, teamId)
          }
        })
        return
      }
      if (shape.type !== "agent" || !shape.props.conversationId) return
      if (shape.props.teamId && shape.props.slotId) {
        if (!editor.getShape(shape.parentId)) return
        const teamId = shape.props.teamId
        const slotId = shape.props.slotId
        const cachedTeam = teamStore.getState().teams[teamId]?.team
        void teamApi.removeMember(teamId, slotId).catch(async () => {
          if (!active) return
          const restorableTeam = teamStore.getState().teams[teamId]?.team ?? cachedTeam
          if (restorableTeam?.canvasId === canvasId) syncCanvasTeams(editor, [restorableTeam])
          try {
            const team = await teamController.refresh(teamId)
            if (!active) return
            if (team?.canvasId === canvasId) syncCanvasTeams(editor, [team])
          } catch (refreshError) {
            if (!active || !isNotFound(refreshError)) return
            teamController.disconnect(teamId)
            teamStore.getState().remove(teamId)
            removeTeamProjection(editor, teamId)
          }
        })
        return
      }
      void conversationController.destroy(shape.props.conversationId).catch(() => undefined)
    })
    return () => {
      active = false
      unregisterBeforeDelete()
      unregisterBeforeChange()
      unregisterAfterCreate()
      unregisterAfterDelete()
    }
  }, [canvasId, editor])

  useEffect(() => {
    if (!editor) return
    let active = true
    const unsubscribe = teamController.subscribe((event) => {
      if (!active) return
      const team = teamStore.getState().teams[event.teamId]?.team
      if (event.type === "team.deleted" || team?.canvasId === canvasId) syncTeamEventToCanvas(editor, event, team)
    })
    void teamController
      .loadCanvas(canvasId)
      .then((teams) => {
        if (active && teams) reconcileCanvasTeams(editor, teams)
      })
      .catch(() => undefined)
    return () => {
      active = false
      unsubscribe()
      teamController.disconnectCanvas(canvasId)
    }
  }, [canvasId, editor])

  useEffect(
    () => () => {
      conversationController.disconnectAll()
      teamController.disconnectAll()
    },
    [],
  )

  const createAgent = useCallback(
    async (draft: AgentDraft) => {
      if (!editor) throw new Error("The canvas is not ready yet.")
      const runner = AGENT_RUNNERS[draft.runner]
      const conversation = await conversationApi.create({
        agent: runner.provider,
        workspace: draft.workspace,
      })
      const id = createShapeId()
      const center = editor.getViewportPageBounds().center
      try {
        editor.createShape({
          id,
          type: "agent",
          x: center.x - 210,
          y: center.y - 280,
          props: {
            runner: draft.runner,
            model: "",
            workspace: conversation.workspace,
            title: `${runner.label} agent`,
            conversationId: conversation.id,
            teamId: "",
            slotId: "",
            role: "",
          },
        })
        editor.select(id)
        setComposerOpen(false)
      } catch (error) {
        await conversationApi.delete(conversation.id)
        throw error
      }
    },
    [editor],
  )

  const createTeam = useCallback(
    async (draft: TeamDraft) => {
      if (!editor) throw new Error("The canvas is not ready yet.")
      const team = await teamApi.create({
        canvasId,
        name: draft.name,
        workspace: draft.workspace,
        leader: { name: draft.leader.name, agent: AGENT_RUNNERS[draft.leader.runner].provider },
        members: draft.members.map((member) => ({ name: member.name, agent: AGENT_RUNNERS[member.runner].provider })),
      })
      try {
        teamController.prepare(team)
        createTeamProjection(editor, team)
        setTeamComposerOpen(false)
      } catch (error) {
        await teamApi.delete(team.id)
        throw error
      }
    },
    [canvasId, editor],
  )

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-background">
      <div className="canvas-stage" data-file-sidebar-open={Boolean(selectedAgent || selectedTeam)}>
        <Tldraw
          components={tldrawComponents}
          onMount={setEditor}
          persistenceKey={`agent-weave-canvas-${canvasId}`}
          shapeUtils={shapeUtils}
        />
        {editor && <SelectionLayoutToolbar editor={editor} />}
      </div>

      {selectedAgent && (
        <FileSidebar
          key={`${selectedAgent.id}:${selectedAgent.props.workspace}`}
          workspace={selectedAgent.props.workspace}
        />
      )}
      {selectedTeam?.props.teamId && (
        <TeamInspector teamId={selectedTeam.props.teamId} onClose={() => editor?.selectNone()} />
      )}

      <header className="canvas-header">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild size="icon" variant="ghost">
            <Link to="/" aria-label="Back to canvases">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="canvas-header__brand"><img src="/icon.png" alt="" /></div>
          <input
            aria-label="Canvas name"
            className="min-w-0 max-w-56 rounded-sm bg-transparent px-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={canvasName}
            onChange={(event) => renameCanvas(canvasId, event.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTeamComposerOpen((open) => !open)}>
            <Users data-icon="inline-start" />
            Agent team
          </Button>
          <Button onClick={() => setComposerOpen((open) => !open)}>
            <Plus data-icon="inline-start" />
            New agent
          </Button>
          <Button size="icon" variant="ghost" aria-label="Workspace settings">
            <Settings />
          </Button>
        </div>
      </header>

      {composerOpen && <AgentComposer onClose={() => setComposerOpen(false)} onCreate={createAgent} />}
      {teamComposerOpen && <CreateTeamDialog onClose={() => setTeamComposerOpen(false)} onCreate={createTeam} />}
    </main>
  )
}

function useSingleSelectedTeam(editor: Editor | null): AgentTeamShape | null {
  return useValue(
    "single-selected-agent-team",
    () => {
      if (!editor) return null
      const shapes = editor.getSelectedShapes()
      return shapes.length === 1 && shapes[0].type === "agent-team" ? (shapes[0] as AgentTeamShape) : null
    },
    [editor],
  )
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 404
}
