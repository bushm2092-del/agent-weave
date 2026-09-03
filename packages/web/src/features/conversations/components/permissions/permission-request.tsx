import { Hand, ShieldCheck } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { conversationApi } from "@/features/conversations/api"
import type { PendingPermission } from "@/features/conversations/conversation-view.types"
import { localizeErrorPresentation, toErrorPresentation, type PresentableError } from "@/i18n"

export function PermissionRequest({
  conversationId,
  permission,
}: {
  conversationId: string
  permission: PendingPermission
}) {
  const { t } = useTranslation()
  const [resolving, setResolving] = useState<string>()
  const [error, setError] = useState<PresentableError>()

  const decide = async (optionId: string) => {
    setResolving(optionId)
    setError(undefined)
    try {
      await conversationApi.decidePermission(conversationId, permission.runId, permission.id, { optionId })
    } catch (requestError) {
      setError(toErrorPresentation(requestError, "errors.fallbacks.permissionResponse"))
      setResolving(undefined)
    }
  }

  return (
    <section className="permission-request" aria-label={t("conversations.permissionRequired")}>
      <div className="permission-request__title">
        <Hand aria-hidden="true" />
        <div>
          <strong>{t("conversations.permissionRequired")}</strong>
          <span>{toolDescription(permission.toolCall, t("conversations.permissionFallback"))}</span>
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
            {resolving === option.optionId ? t("conversations.applying") : option.name}
          </button>
        ))}
      </div>
      {error && <p className="permission-request__error">{localizeErrorPresentation(error, t)}</p>}
    </section>
  )
}

function toolDescription(value: unknown, fallback: string): string {
  if (!value || typeof value !== "object") return fallback
  const tool = value as Record<string, unknown>
  for (const key of ["title", "name", "kind"]) {
    if (typeof tool[key] === "string") return tool[key]
  }
  return fallback
}
