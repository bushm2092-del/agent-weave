import { Columns3, LayoutGrid, LayoutPanelLeft, Rows3 } from "lucide-react"
import type { PointerEvent } from "react"
import type { Editor } from "tldraw"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { formatNumber } from "@/i18n"

import type { AgentLayoutPreset } from "./layout.types"
import { SelectionLayoutDivider } from "./selection-layout-divider"
import { useSelectionLayout } from "./use-selection-layout"

const actions: Array<{
  preset: AgentLayoutPreset
  key: "grid" | "horizontal" | "vertical" | "primary"
  icon: typeof LayoutGrid
}> = [
  { preset: "grid", key: "grid", icon: LayoutGrid },
  { preset: "horizontal", key: "horizontal", icon: Columns3 },
  { preset: "vertical", key: "vertical", icon: Rows3 },
  { preset: "primary", key: "primary", icon: LayoutPanelLeft },
]

export function SelectionLayoutToolbar({ editor }: { editor: Editor }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en"
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
        aria-label={t("canvas.layout.arrangeCount", {
          count: selection.count,
          formattedCount: formatNumber(selection.count, locale),
        })}
        className="selection-layout-toolbar"
        role="toolbar"
        style={{ left: selection.x, top: selection.y }}
        onPointerDown={handlePointerDown}
      >
        <span className="selection-layout-toolbar__count">
          {t("canvas.layout.selectedCount", {
            count: selection.count,
            formattedCount: formatNumber(selection.count, locale),
          })}
        </span>
        <span className="selection-layout-toolbar__divider" aria-hidden="true" />
        {actions.map(({ preset, key, icon: Icon }) => {
          const label = t(`canvas.layout.${key}`)
          return (
            <Button key={preset} size="icon-sm" title={label} variant="ghost" onClick={() => applyLayout(preset)}>
              <Icon />
              <span className="sr-only">{label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
