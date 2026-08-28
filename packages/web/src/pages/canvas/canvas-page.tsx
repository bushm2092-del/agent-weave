import { ArrowLeft, Eye, Focus, Settings } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router"
import {
  createShapeId,
  getSnapshot,
  loadSnapshot,
  Tldraw,
  type Editor,
  type TLComponents,
  type TLShapeId,
  useValue,
} from "tldraw"
import "tldraw/tldraw.css"

import { Button } from "@/components/ui/button"
import { AgentComposer, type AgentDraft } from "@/features/canvas/agent-composer"
import { CanvasToolbar } from "@/features/canvas/canvas-toolbar"
import { SelectionLayoutToolbar } from "@/features/canvas/layout"
import { AGENT_RUNNERS } from "@/features/canvas/agent-options"
import { AgentShapeUtil } from "@/features/canvas/shapes/agent"
import { AgentTeamShapeUtil } from "@/features/canvas/shapes/agent-team"
import { FilePreviewShapeUtil } from "@/features/canvas/shapes/file-preview"
import { canvasApi, canvasController } from "@/features/canvases"
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

const shapeUtils = [AgentShapeUtil, AgentTeamShapeUtil, FilePreviewShapeUtil]
export function CanvasPage() {
  const { canvasId = "untitled" } = useParams()
  const [editor, setEditor] = useState<Editor | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [teamComposerOpen, setTeamComposerOpen] = useState(false)
  const [cleanUi, setCleanUi] = useState(false)
  const [canvasName, setCanvasName] = useState("Untitled canvas")
  const [canvasError, setCanvasError] = useState<string>()
  const selectedAgent = useSingleSelectedAgent(editor)
  const selectedTeam = useSingleSelectedTeam(editor)
  const tldrawComponents = useMemo<TLComponents>(() => {
    function Toolbar() {
      return (
        <CanvasToolbar
          onCreateAgent={() => {
            setTeamComposerOpen(false)
            setComposerOpen(true)
          }}
          onCreateTeam={() => {
            setComposerOpen(false)
            setTeamComposerOpen(true)
          }}
          onCreateFilePreview={() => {
            const input = document.createElement("input")
            input.type = "file"
            input.accept = "image/*,.md,.markdown,.txt,.csv,.pdf,.xlsx,.xls,.docx,.doc"
            input.onchange = () => {
              const file = input.files?.[0]
              if (!file || !editor) return
              const reader = new FileReader()
              reader.onload = () => {
                const center = editor.getViewportPageBounds().center
                const id = createShapeId()
                editor.createShape({ id, type: "file-preview", x: center.x - 180, y: center.y - 140, props: { name: file.name, mimeType: file.type || "application/octet-stream", dataUrl: String(reader.result), w: 360, h: 280 } })
                editor.select(id)
              }
              reader.readAsDataURL(file)
            }
            input.click()
          }}
        />
      )
    }
    return { StylePanel: null, Toolbar }
  }, [])

  useEffect(() => {
    if (!cleanUi) return
    document.body.classList.add("agent-weave-clean-ui")
    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCleanUi(false)
    }
    document.addEventListener("keydown", exitOnEscape)
    return () => {
      document.body.classList.remove("agent-weave-clean-ui")
      document.removeEventListener("keydown", exitOnEscape)
    }
  }, [cleanUi])

  const enterCleanUi = () => {
    setComposerOpen(false)
    setTeamComposerOpen(false)
    editor?.selectNone()
    setCleanUi(true)
  }

  useEffect(() => {
    let active = true
    setCanvasError(undefined)
    void canvasController
      .get(canvasId)
      .then((canvas) => {
        if (active) setCanvasName(canvas.name)
      })
      .catch((error) => {
        if (active) setCanvasError(error instanceof Error ? error.message : "Unable to load canvas.")
      })
    return () => {
      active = false
    }
  }, [canvasId])

  const mountEditor = useCallback(
    async (mountedEditor: Editor) => {
      try {
        const snapshot = await canvasApi.getSnapshot(canvasId)
        if (snapshot.document) {
          loadSnapshot(mountedEditor.store, {
            document: snapshot.document as ReturnType<typeof getSnapshot>["document"],
          })
          mountedEditor.clearHistory()
          if (!snapshot.thumbnailDataUrl) {
            window.requestAnimationFrame(() => {
              void createCanvasThumbnail(mountedEditor)
                .then((thumbnailDataUrl) => {
                  if (thumbnailDataUrl) {
                    return canvasApi.saveSnapshot(canvasId, { document: snapshot.document, thumbnailDataUrl })
                  }
                })
                .catch(() => undefined)
            })
          }
        }
        setEditor(mountedEditor)
      } catch (error) {
        setCanvasError(error instanceof Error ? error.message : "Unable to load canvas content.")
      }
    },
    [canvasId],
  )

  useEffect(() => {
    if (!editor) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let saveTail = Promise.resolve()
    const persist = () => {
      const document = getSnapshot(editor.store).document
      saveTail = saveTail
        .catch(() => undefined)
        .then(async () => {
          const thumbnailDataUrl = await createCanvasThumbnail(editor)
          await canvasApi.saveSnapshot(canvasId, { document, thumbnailDataUrl })
        })
        .then(() => undefined)
        .catch((error) => {
          setCanvasError(error instanceof Error ? error.message : "Unable to save canvas content.")
        })
    }
    const unsubscribe = editor.store.listen(
      () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(persist, 700)
      },
      { source: "all", scope: "document" },
    )
    return () => {
      unsubscribe()
      if (timer) {
        clearTimeout(timer)
        persist()
      }
    }
  }, [canvasId, editor])

  const saveCanvasName = () => {
    const name = canvasName.trim()
    if (!name) return
    void canvasController.update(canvasId, { name }).catch((error) => {
      setCanvasError(error instanceof Error ? error.message : "Unable to rename canvas.")
    })
  }

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
        leader: { name: draft.leader.name, agent: AGENT_RUNNERS[draft.leader.runner].provider, ...(draft.leader.rolePresetId ? { rolePresetId: draft.leader.rolePresetId } : {}) },
        members: draft.members.map((member) => ({ name: member.name, agent: AGENT_RUNNERS[member.runner].provider, ...(member.rolePresetId ? { rolePresetId: member.rolePresetId } : {}) })),
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
    <main
      className="canvas-page relative h-dvh w-dvw overflow-hidden bg-background"
      data-clean-ui={cleanUi}
    >
      <div className="canvas-stage" data-file-sidebar-open={Boolean(selectedAgent || selectedTeam)}>
        <Tldraw
          key={canvasId}
          components={tldrawComponents}
          onMount={(mountedEditor) => void mountEditor(mountedEditor)}
          shapeUtils={shapeUtils}
        />
        {editor && !cleanUi && <SelectionLayoutToolbar editor={editor} />}
      </div>

      {!cleanUi && selectedAgent && (
        <FileSidebar
          key={`${selectedAgent.id}:${selectedAgent.props.workspace}`}
          workspace={selectedAgent.props.workspace}
        />
      )}
      {!cleanUi && selectedTeam?.props.teamId && (
        <TeamInspector teamId={selectedTeam.props.teamId} onClose={() => editor?.selectNone()} />
      )}

      {!cleanUi && <header className="canvas-header">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild size="icon-sm" variant="ghost">
            <Link to="/" aria-label="Back to canvases">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="canvas-header__brand"><img src="/icon.png" alt="" /></div>
          <input
            aria-label="Canvas name"
            className="min-w-0 max-w-56 rounded-sm bg-transparent px-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={canvasName}
            onBlur={saveCanvasName}
            onChange={(event) => setCanvasName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur()
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button size="icon-sm" variant="ghost" aria-label="Workspace settings">
            <Settings />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label="Show only whiteboard" title="Clean UI" onClick={enterCleanUi}>
            <Focus />
          </Button>
        </div>
      </header>}

      {!cleanUi && canvasError && <div className="canvas-error">{canvasError}</div>}

      {cleanUi && (
        <Button
          className="canvas-clean-ui__exit"
          size="icon-sm"
          variant="outline"
          aria-label="Restore interface"
          title="Restore interface (Esc)"
          onClick={() => setCleanUi(false)}
        >
          <Eye />
        </Button>
      )}

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

async function createCanvasThumbnail(editor: Editor): Promise<string | null | undefined> {
  const shapeIds = [...editor.getCurrentPageShapeIds()]
  if (!shapeIds.length) return null
  const bounds = editor.getShapesPageBounds(shapeIds)
  if (!bounds) return null

  try {
    const maxDimension = 640
    const scale = Math.min(1, maxDimension / Math.max(bounds.width + 48, bounds.height + 48))
    const { blob } = await editor.toImage(shapeIds, {
      background: true,
      darkMode: false,
      format: "webp",
      padding: 24,
      pixelRatio: 1,
      preserveAspectRatio: "xMidYMid meet",
      quality: 0.76,
      scale,
    })
    return await blobToDataUrl(blob)
  } catch {
    // Saving the document is more important than refreshing its optional preview.
    return undefined
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener("load", () => resolve(String(reader.result)))
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Unable to read canvas thumbnail.")))
    reader.readAsDataURL(blob)
  })
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 404
}
