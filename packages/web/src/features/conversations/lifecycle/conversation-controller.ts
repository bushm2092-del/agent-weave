import type { Conversation, ConversationEvent } from "@agent-weave/contracts"

import { conversationApi, openConversationEventStream } from "@/features/conversations/api"
import { conversationStore } from "@/features/conversations/store"
import { toErrorPresentation } from "@/i18n"

type ActiveConnection = {
  cancelled: boolean
  source?: EventSource
  pendingEvents: ConversationEvent[]
  flushTimer?: ReturnType<typeof setTimeout>
}

const EVENT_RENDER_INTERVAL_MS = 16

class ConversationController {
  private readonly connections = new Map<string, ActiveConnection>()

  connect(conversationId: string): void {
    if (!conversationId || this.connections.has(conversationId)) return
    const connection: ActiveConnection = { cancelled: false, pendingEvents: [] }
    this.connections.set(conversationId, connection)
    conversationStore.getState().setConnectionStatus(conversationId, "connecting")
    void this.initializeConnection(conversationId, connection)
  }

  async destroy(conversationId: string): Promise<void> {
    this.disconnect(conversationId)
    try {
      await conversationApi.delete(conversationId)
      conversationStore.getState().remove(conversationId)
    } catch (error) {
      conversationStore
        .getState()
        .setError(conversationId, toErrorPresentation(error, "errors.fallbacks.conversationRequest"))
      throw error
    }
  }

  disconnect(conversationId: string): void {
    const connection = this.connections.get(conversationId)
    if (!connection) return
    connection.cancelled = true
    connection.source?.close()
    if (connection.flushTimer) clearTimeout(connection.flushTimer)
    connection.pendingEvents.length = 0
    this.connections.delete(conversationId)
    conversationStore.getState().setConnectionStatus(conversationId, "idle")
  }

  disconnectAll(): void {
    for (const conversationId of this.connections.keys()) this.disconnect(conversationId)
  }

  private async initializeConnection(conversationId: string, connection: ActiveConnection): Promise<void> {
    try {
      const [conversation, runs] = await Promise.all([
        conversationApi.get(conversationId),
        conversationApi.listRuns(conversationId),
      ])
      if (connection.cancelled) return
      conversationStore.getState().prepareReplay(conversation, runs)
      const after = conversationStore.getState().conversations[conversationId]?.lastSequence ?? 0
      connection.source = openConversationEventStream({
        conversationId,
        after,
        onEvent: (event) => this.enqueueEvent(connection, event),
        onConnectionChange: (connected) => {
          if (connection.cancelled) return
          conversationStore.getState().setConnectionStatus(conversationId, connected ? "connected" : "reconnecting")
        },
        onProtocolError: (message) => conversationStore.getState().setError(conversationId, message),
      })
    } catch (error) {
      this.connections.delete(conversationId)
      conversationStore
        .getState()
        .setError(conversationId, toErrorPresentation(error, "errors.fallbacks.conversationRequest"))
    }
  }

  private enqueueEvent(connection: ActiveConnection, event: ConversationEvent): void {
    if (connection.cancelled) return
    connection.pendingEvents.push(event)
    if (connection.flushTimer) return
    connection.flushTimer = setTimeout(() => {
      connection.flushTimer = undefined
      if (connection.cancelled || !connection.pendingEvents.length) return
      const events = connection.pendingEvents.splice(0)
      conversationStore.getState().applyEvents(events)
    }, EVENT_RENDER_INTERVAL_MS)
  }
}

export function updateConversationSnapshot(conversation: Conversation): void {
  conversationStore.getState().prepareReplay(conversation)
}

export const conversationController = new ConversationController()
