import { Check, CircleDashed, Wrench } from "lucide-react"
import { useTranslation } from "react-i18next"

import type { ToolActivity } from "@/features/conversations/conversation-view.types"

export function ToolCallItem({ tool }: { tool: ToolActivity }) {
  const { t } = useTranslation()
  const complete = tool.status === "completed" || tool.status === "done"
  return (
    <details className="tool-call">
      <summary>
        {complete ? (
          <Check aria-hidden="true" />
        ) : tool.status ? (
          <CircleDashed aria-hidden="true" />
        ) : (
          <Wrench aria-hidden="true" />
        )}
        <span>{tool.title || tool.text || tool.kind || t("conversations.toolCall")}</span>
        {tool.status && <small>{localizeToolStatus(tool.status, t)}</small>}
      </summary>
      <div className="tool-call__details">
        {tool.rawInput !== undefined && <ToolData label={t("common.input")} value={tool.rawInput} />}
        {tool.rawOutput !== undefined && <ToolData label={t("common.output")} value={tool.rawOutput} />}
        {tool.locations !== undefined && <ToolData label={t("common.locations")} value={tool.locations} />}
      </div>
    </details>
  )
}

function localizeToolStatus(status: string, t: ReturnType<typeof useTranslation>["t"]): string {
  if (status === "completed" || status === "done" || status === "failed" || status === "running") {
    return t(`conversations.toolStatus.${status}`)
  }
  return status
}

function ToolData({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <strong>{label}</strong>
      <pre>{formatValue(value)}</pre>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
