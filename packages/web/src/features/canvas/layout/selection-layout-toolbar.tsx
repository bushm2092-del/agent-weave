import { Columns3, LayoutGrid, LayoutPanelLeft, Rows3 } from "lucide-react"
import type { PointerEvent } from "react"
import type { Editor } from "tldraw"

import { Button } from "@/components/ui/button"

import type { AgentLayoutPreset } from "./layout.types"
import { SelectionLayoutDivider } from "./selection-layout-divider"
import { useSelectionLayout } from "./use-selection-layout"

const actions: Array<{
  preset: AgentLayoutPreset
  label: string
  icon: typeof LayoutGrid
}> = [
  { preset: "grid", label: "Arrange in grid", icon: LayoutGrid },
  { preset: "horizontal", label: "Arrange horizontally", icon: Columns3 },
  { preset: "vertical", label: "Arrange vertically", icon: Rows3 },
  { preset: "primary", label: "Arrange with primary agent", icon: LayoutPanelLeft },
]

export function SelectionLayoutToolbar({ editor }: { editor: Editor }) {
  const { selection, applyLayout } = useSelectionLayout(editor)
  if (!selection) return null

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    editor.markEventAsHandled(event)
    event.stopPropagation()
  }

  return (
    <div className="selection-layout-toolbar-layer" aria-hidden={false}>
      {selection.split && <SelectionLayoutDivider editor={editor} split={selection.split} />}
      <div
        aria-label={`Arrange ${selection.count} selected agents`}
        className="selection-layout-toolbar"
        role="toolbar"
        style={{ left: selection.x, top: selection.y }}
        onPointerDown={handlePointerDown}
      >
        <span className="selection-layout-toolbar__count">{selection.count} agents</span>
        <span className="selection-layout-toolbar__divider" aria-hidden="true" />
        {actions.map(({ preset, label, icon: Icon }) => (
          <Button key={preset} size="icon-sm" title={label} variant="ghost" onClick={() => applyLayout(preset)}>
            <Icon />
            <span className="sr-only">{label}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}
