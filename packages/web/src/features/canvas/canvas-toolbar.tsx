import { Bot, FileSearch, Hand, MousePointer2, Users } from "lucide-react"
import { type Editor, useEditor, useValue } from "tldraw"

import { Button } from "@/components/ui/button"

export function CanvasToolbar({
  onCreateAgent,
  onCreateTeam,
  onCreateFilePreview,
}: {
  onCreateAgent: () => void
  onCreateTeam: () => void
  onCreateFilePreview: (editor: Editor) => void
}) {
  const editor = useEditor()
  const activeTool = useValue("canvas toolbar active tool", () => editor.getCurrentToolId(), [editor])

  const selectTool = (tool: "select" | "hand") => editor.setCurrentTool(tool)
  const openCreator = (open: () => void) => {
    editor.setCurrentTool("select")
    open()
  }

  return (
    <div className="canvas-toolbox" role="toolbar" aria-label="Canvas tools">
      <Button
        size="icon"
        variant={activeTool === "select" ? "default" : "ghost"}
        aria-label="Select"
        title="Select"
        onClick={() => selectTool("select")}
      >
        <MousePointer2 />
      </Button>
      <Button
        size="icon"
        variant={activeTool === "hand" ? "default" : "ghost"}
        aria-label="Hand tool"
        title="Hand tool"
        onClick={() => selectTool("hand")}
      >
        <Hand />
      </Button>
      <span className="canvas-toolbox__divider" aria-hidden="true" />
      <Button size="icon" variant="ghost" aria-label="New agent" title="New agent" onClick={() => openCreator(onCreateAgent)}>
        <Bot />
      </Button>
      <Button size="icon" variant="ghost" aria-label="New agent team" title="New agent team" onClick={() => openCreator(onCreateTeam)}>
        <Users />
      </Button>
      <Button size="icon" variant="ghost" aria-label="New file preview" title="New file preview" onClick={() => openCreator(() => onCreateFilePreview(editor))}>
        <FileSearch />
      </Button>
    </div>
  )
}
