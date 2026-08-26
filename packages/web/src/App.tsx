import { Plus, Settings, Users } from 'lucide-react'
import { useCallback, useState } from 'react'
import { createShapeId, Tldraw, type Editor } from 'tldraw'
import 'tldraw/tldraw.css'

import { Button } from '@/components/ui/button'
import {
  AgentComposer,
  type AgentDraft,
} from '@/features/canvas/agent-composer'
import { AGENT_RUNNERS } from '@/features/canvas/agent-options'
import { AgentShapeUtil } from '@/features/canvas/shapes/agent-shape'
import { AgentTeamShapeUtil } from '@/features/canvas/shapes/agent-team-shape'
import { useWorkspaceStore } from '@/stores/workspace-store'

const shapeUtils = [AgentShapeUtil, AgentTeamShapeUtil]

export function App() {
  const [editor, setEditor] = useState<Editor | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const canvasName = useWorkspaceStore((state) => state.canvasName)
  const renameCanvas = useWorkspaceStore((state) => state.renameCanvas)

  const createAgent = useCallback((draft: AgentDraft) => {
    if (!editor) return

    const id = createShapeId()
    const center = editor.getViewportPageBounds().center
    const runner = AGENT_RUNNERS[draft.runner]

    editor.createShape({
      id,
      type: 'agent',
      x: center.x - 160,
      y: center.y - 112,
      props: {
        runner: draft.runner,
        model: draft.model,
        workspace: draft.workspace,
        title: `${runner.label} agent`,
      },
    })
    editor.select(id)
    setComposerOpen(false)
  }, [editor])

  const createTeam = useCallback(() => {
    if (!editor) return

    const id = createShapeId()
    const center = editor.getViewportPageBounds().center

    editor.createShape({
      id,
      type: 'agent-team',
      x: center.x - 380,
      y: center.y - 230,
    })
    editor.sendToBack([id])
    editor.select(id)
  }, [editor])

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-background">
      <div className="absolute inset-0 pt-14">
        <Tldraw
          onMount={setEditor}
          persistenceKey="agent-weave-main-canvas"
          shapeUtils={shapeUtils}
        />
      </div>

      <header className="absolute inset-x-0 top-0 z-20 flex h-14 items-center justify-between border-b bg-background px-3 shadow-xs">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-sm font-semibold text-background">
            AW
          </div>
          <input
            aria-label="Canvas name"
            className="min-w-0 max-w-56 rounded-sm bg-transparent px-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={canvasName}
            onChange={(event) => renameCanvas(event.target.value)}
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

      {composerOpen && (
        <AgentComposer onClose={() => setComposerOpen(false)} onCreate={createAgent} />
      )}
    </main>
  )
}
