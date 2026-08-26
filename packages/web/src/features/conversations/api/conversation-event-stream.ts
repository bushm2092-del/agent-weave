import { conversationEventSchema, conversationEventTypeSchema, type ConversationEvent } from "@agent-weave/contracts"

import { environment } from "@/config/env"

export type ConversationEventStreamOptions = {
  conversationId: string
  after: number
  onEvent: (event: ConversationEvent) => void
  onConnectionChange: (connected: boolean) => void
  onProtocolError: (message: string) => void
}

export function openConversationEventStream(options: ConversationEventStreamOptions): EventSource {
  const baseUrl = environment.apiBaseUrl.replace(/\/$/, "")
  const url = new URL(
    `${baseUrl}/conversations/${encodeURIComponent(options.conversationId)}/events`,
    window.location.origin,
  )
  url.searchParams.set("after", String(options.after))

  const source = new EventSource(url)
  source.onopen = () => options.onConnectionChange(true)
  source.onerror = () => options.onConnectionChange(false)

  const handleEvent = (message: MessageEvent<string>) => {
    try {
      const parsed = conversationEventSchema.safeParse(JSON.parse(message.data))
      if (!parsed.success) {
        options.onProtocolError("The server sent an invalid conversation event.")
        return
      }
      options.onEvent(parsed.data)
    } catch {
      options.onProtocolError("The server sent malformed conversation event data.")
    }
  }

  for (const eventType of conversationEventTypeSchema.options) {
    source.addEventListener(eventType, handleEvent as EventListener)
  }
  return source
}
