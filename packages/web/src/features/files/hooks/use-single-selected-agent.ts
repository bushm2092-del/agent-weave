import { type Editor, useValue } from "tldraw"

import type { AgentShape } from "@/features/canvas/shapes/agent/agent-shape"

export function useSingleSelectedAgent(editor: Editor | null): AgentShape | null {
  return useValue(
    "single-selected-agent-files",
    () => {
      if (!editor) return null
      const shapes = editor.getSelectedShapes()
      if (shapes.length !== 1 || shapes[0].type !== "agent") return null
      const agent = shapes[0] as AgentShape
      return agent.props.workspace.trim() ? agent : null
    },
    [editor],
  )
}
