import { Plus, Settings } from 'lucide-react'
import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'

import { Button } from '@/components/ui/button'
import { useWorkspaceStore } from '@/stores/workspace-store'

export function App() {
  const canvasName = useWorkspaceStore((state) => state.canvasName)
  const renameCanvas = useWorkspaceStore((state) => state.renameCanvas)

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-background">
      <div className="absolute inset-0">
        <Tldraw persistenceKey="agent-weave-main-canvas" />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-between border-b bg-background/95 px-3 shadow-xs backdrop-blur-sm">
        <div className="pointer-events-auto flex min-w-0 items-center gap-3">
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

        <div className="pointer-events-auto flex items-center gap-2">
          <Button variant="outline">
            <Plus data-icon="inline-start" />
            New agent
          </Button>
          <Button size="icon" variant="ghost" aria-label="Workspace settings">
            <Settings />
          </Button>
        </div>
      </header>
    </main>
  )
}
