import { Bot, FileSearch, Hand, MousePointer2, Users } from "lucide-react"
import { type Editor, useEditor, useValue } from "tldraw"
import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation()
  const editor = useEditor()
  const activeTool = useValue("canvas toolbar active tool", () => editor.getCurrentToolId(), [editor])

  const selectTool = (tool: "select" | "hand") => editor.setCurrentTool(tool)
  const openCreator = (open: () => void) => {
    editor.setCurrentTool("select")
    open()
  }

  return (
    <div className="canvas-toolbox" role="toolbar" aria-label={t("canvas.tools.label")}>
      <Button
        size="icon"
        variant={activeTool === "select" ? "default" : "ghost"}
        aria-label={t("canvas.tools.select")}
        title={t("canvas.tools.select")}
        onClick={() => selectTool("select")}
      >
        <MousePointer2 />
      </Button>
      <Button
        size="icon"
        variant={activeTool === "hand" ? "default" : "ghost"}
        aria-label={t("canvas.tools.hand")}
        title={t("canvas.tools.hand")}
        onClick={() => selectTool("hand")}
      >
        <Hand />
      </Button>
      <span className="canvas-toolbox__divider" aria-hidden="true" />
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("canvas.tools.newAgent")}
        title={t("canvas.tools.newAgent")}
        onClick={() => openCreator(onCreateAgent)}
      >
        <Bot />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("canvas.tools.newTeam")}
        title={t("canvas.tools.newTeam")}
        onClick={() => openCreator(onCreateTeam)}
      >
        <Users />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t("canvas.tools.newFilePreview")}
        title={t("canvas.tools.newFilePreview")}
        onClick={() => openCreator(() => onCreateFilePreview(editor))}
      >
        <FileSearch />
      </Button>
    </div>
  )
}
