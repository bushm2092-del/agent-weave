import type { AgentConfigOption, Conversation, SetConfigOptionRequest } from "@agent-weave/contracts"
import { SlidersHorizontal } from "lucide-react"
import { useState } from "react"

import { conversationApi } from "@/features/conversations/api"
import { updateConversationSnapshot } from "@/features/conversations/lifecycle"
import { ApiClientError } from "@/lib/api"

export function ConfigOptionControls({ conversation }: { conversation: Conversation }) {
  const [updating, setUpdating] = useState<string>()
  const [error, setError] = useState<string>()

  if (!conversation.configOptions.length) return null

  const update = async (option: AgentConfigOption, input: SetConfigOptionRequest) => {
    setUpdating(option.id)
    setError(undefined)
    try {
      const updated = await conversationApi.setConfigOption(conversation.id, option.id, input)
      updateConversationSnapshot(updated)
    } catch (requestError) {
      setError(requestError instanceof ApiClientError ? requestError.message : "Configuration update failed.")
    } finally {
      setUpdating(undefined)
    }
  }

  return (
    <div className="agent-config">
      <SlidersHorizontal aria-hidden="true" />
      <div className="agent-config__options">
        {conversation.configOptions.map((option) => (
          <ConfigControl
            disabled={updating === option.id}
            key={option.id}
            onChange={(input) => void update(option, input)}
            option={option}
          />
        ))}
      </div>
      {error && (
        <span className="agent-config__error" title={error}>
          {error}
        </span>
      )}
    </div>
  )
}

function ConfigControl({
  option,
  disabled,
  onChange,
}: {
  option: AgentConfigOption
  disabled: boolean
  onChange: (input: SetConfigOptionRequest) => void
}) {
  if (option.type === "boolean") {
    return (
      <label className="agent-config__boolean" title={option.description}>
        <input
          checked={option.currentValue}
          disabled={disabled}
          type="checkbox"
          onChange={(event) => onChange({ type: "boolean", value: event.target.checked })}
        />
        <span>{option.name}</span>
      </label>
    )
  }

  return (
    <label className="agent-config__select" title={option.description}>
      <span>{option.name}</span>
      <select
        aria-label={option.name}
        disabled={disabled}
        value={option.currentValue}
        onChange={(event) => onChange({ type: "select", value: event.target.value })}
      >
        {isGrouped(option.options)
          ? option.options.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.options.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.name}
                  </option>
                ))}
              </optgroup>
            ))
          : option.options.map((item) => (
              <option key={item.value} value={item.value}>
                {item.name}
              </option>
            ))}
      </select>
    </label>
  )
}

function isGrouped(
  options: Extract<AgentConfigOption, { type: "select" }>["options"],
): options is Array<{ group: string; options: Array<{ value: string; name: string }> }> {
  return options.length > 0 && "group" in options[0]
}
