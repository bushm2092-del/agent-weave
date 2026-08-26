import { Check, CircleDashed, Wrench } from "lucide-react"

import type { ToolActivity } from "@/features/conversations/conversation-view.types"

export function ToolCallItem({ tool }: { tool: ToolActivity }) {
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
        <span>{tool.title || tool.text || tool.kind || "Tool call"}</span>
        {tool.status && <small>{tool.status}</small>}
      </summary>
      <div className="tool-call__details">
        {tool.rawInput !== undefined && <ToolData label="Input" value={tool.rawInput} />}
        {tool.rawOutput !== undefined && <ToolData label="Output" value={tool.rawOutput} />}
        {tool.locations !== undefined && <ToolData label="Locations" value={tool.locations} />}
      </div>
    </details>
  )
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
