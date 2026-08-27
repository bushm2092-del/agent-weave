import { teamEventSchema, teamEventTypeSchema, type TeamEvent } from "@agent-weave/contracts"
import { environment } from "@/config/env"

export type TeamEventStreamOptions = {
  teamId: string
  after: number
  onEvent: (event: TeamEvent) => void
  onConnectionChange: (connected: boolean) => void
  onProtocolError: (message: string) => void
}

export function openTeamEventStream(options: TeamEventStreamOptions): EventSource {
  const baseUrl = environment.apiBaseUrl.replace(/\/$/, "")
  const url = new URL(`${baseUrl}/teams/${encodeURIComponent(options.teamId)}/events`, window.location.origin)
  url.searchParams.set("after", String(options.after))
  const source = new EventSource(url)
  source.onopen = () => options.onConnectionChange(true)
  source.onerror = () => options.onConnectionChange(false)

  const handleEvent = (message: MessageEvent<string>) => {
    try {
      const parsed = teamEventSchema.safeParse(JSON.parse(message.data))
      if (!parsed.success) {
        options.onProtocolError("The server sent an invalid team event.")
        return
      }
      options.onEvent(parsed.data)
    } catch {
      options.onProtocolError("The server sent malformed team event data.")
    }
  }
  for (const eventType of teamEventTypeSchema.options) {
    source.addEventListener(eventType, handleEvent as EventListener)
  }
  return source
}
