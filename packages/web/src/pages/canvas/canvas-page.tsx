import { ArrowLeft, Plus, Settings, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import { createShapeId, Tldraw, type Editor } from "tldraw"
import "tldraw/tldraw.css"

import { Button } from "@/components/ui/button"
import { AgentComposer, type AgentDraft } from "@/features/canvas/agent-composer"
import { AGENT_RUNNERS } from "@/features/canvas/agent-options"
import { AgentShapeUtil } from "@/features/canvas/shapes/agent"
import { AgentTeamShapeUtil } from "@/features/canvas/shapes/agent-team"
import { conversationApi, conversationController } from "@/features/conversations"
import { getWorkspace } from "@/pages/home/workspaces"
import { useWorkspaceStore } from "@/stores/workspace-store"

const shapeUtils = [AgentShapeUtil, AgentTeamShapeUtil]

export function CanvasPage() {
  const { canvasId = "untitled" } = useParams()
  const [editor, setEditor] = useState<Editor | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const fallbackName = getWorkspace(canvasId)?.name ?? "Untitled canvas"
  const canvasName = useWorkspaceStore((state) => state.canvasNames[canvasId] ?? fallbackName)
  const renameCanvas = useWorkspaceStore((state) => state.renameCanvas)

  useEffect(() => {
    if (!editor) return
    const unregister = editor.sideEffects.registerAfterDeleteHandler("shape", (shape) => {
      if (shape.type !== "agent" || !shape.props.conversationId) return
      void conversationController.destroy(shape.props.conversationId).catch(() => undefined)
    })
    return unregister
  }, [editor])

  useEffect(() => () => conversationController.disconnectAll(), [])

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

  const createTeam = useCallback(() => {
    if (!editor) return
    const id = createShapeId()
    const center = editor.getViewportPageBounds().center
    editor.createShape({ id, type: "agent-team", x: center.x - 490, y: center.y - 350 })
    editor.sendToBack([id])
    editor.select(id)
  }, [editor])

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-background">
      <div className="absolute inset-0 pt-14">
        <Tldraw onMount={setEditor} persistenceKey={`agent-weave-canvas-${canvasId}`} shapeUtils={shapeUtils} />
      </div>

      <header className="canvas-header">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild size="icon" variant="ghost">
            <Link to="/" aria-label="Back to canvases">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="canvas-header__brand">AW</div>
          <input
            aria-label="Canvas name"
            className="min-w-0 max-w-56 rounded-sm bg-transparent px-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={canvasName}
            onChange={(event) => renameCanvas(canvasId, event.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={createTeam}>
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
    </main>
  )
}
