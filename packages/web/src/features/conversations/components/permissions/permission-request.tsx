import { Hand, ShieldCheck } from "lucide-react"
import { useState } from "react"

import { conversationApi } from "@/features/conversations/api"
import type { PendingPermission } from "@/features/conversations/conversation-view.types"
import { ApiClientError } from "@/lib/api"

export function PermissionRequest({
  conversationId,
  permission,
}: {
  conversationId: string
  permission: PendingPermission
}) {
  const [resolving, setResolving] = useState<string>()
  const [error, setError] = useState<string>()

  const decide = async (optionId: string) => {
    setResolving(optionId)
    setError(undefined)
    try {
      await conversationApi.decidePermission(conversationId, permission.runId, permission.id, { optionId })
    } catch (requestError) {
      setError(requestError instanceof ApiClientError ? requestError.message : "Permission response failed.")
      setResolving(undefined)
    }
  }

  return (
    <section className="permission-request" aria-label="Permission required">
      <div className="permission-request__title">
        <Hand aria-hidden="true" />
        <div>
          <strong>Permission required</strong>
          <span>{toolDescription(permission.toolCall)}</span>
        </div>
      </div>
      <div className="permission-request__options">
        {permission.options.map((option) => (
          <button
            data-reject={option.kind.startsWith("reject")}
            disabled={!!resolving}
            key={option.optionId}
            type="button"
            onClick={() => void decide(option.optionId)}
          >
            <ShieldCheck aria-hidden="true" />
            {resolving === option.optionId ? "Applying..." : option.name}
          </button>
        ))}
      </div>
      {error && <p className="permission-request__error">{error}</p>}
    </section>
  )
}

function toolDescription(value: unknown): string {
  if (!value || typeof value !== "object") return "The agent wants to perform an operation."
  const tool = value as Record<string, unknown>
  for (const key of ["title", "name", "kind"]) {
    if (typeof tool[key] === "string") return tool[key]
  }
  return "The agent wants to perform an operation."
}
