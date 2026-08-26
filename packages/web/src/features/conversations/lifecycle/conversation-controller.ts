import type { Conversation } from "@agent-weave/contracts"

import { conversationApi, openConversationEventStream } from "@/features/conversations/api"
import { conversationStore } from "@/features/conversations/store"
import { ApiClientError } from "@/lib/api"

type ActiveConnection = {
  cancelled: boolean
  source?: EventSource
}

class ConversationController {
  private readonly connections = new Map<string, ActiveConnection>()

  connect(conversationId: string): void {
    if (!conversationId || this.connections.has(conversationId)) return
    const connection: ActiveConnection = { cancelled: false }
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
      conversationStore.getState().setError(conversationId, errorMessage(error))
      throw error
    }
  }

  disconnect(conversationId: string): void {
    const connection = this.connections.get(conversationId)
    if (!connection) return
    connection.cancelled = true
    connection.source?.close()
    this.connections.delete(conversationId)
    conversationStore.getState().setConnectionStatus(conversationId, "idle")
  }

  disconnectAll(): void {
    for (const conversationId of this.connections.keys()) this.disconnect(conversationId)
  }

  private async initializeConnection(conversationId: string, connection: ActiveConnection): Promise<void> {
    try {
      const conversation = await conversationApi.get(conversationId)
      if (connection.cancelled) return
      conversationStore.getState().prepareReplay(conversation)
      const after = conversationStore.getState().conversations[conversationId]?.lastSequence ?? 0
      connection.source = openConversationEventStream({
        conversationId,
        after,
        onEvent: (event) => conversationStore.getState().applyEvent(event),
        onConnectionChange: (connected) => {
          if (connection.cancelled) return
          conversationStore.getState().setConnectionStatus(conversationId, connected ? "connected" : "reconnecting")
        },
        onProtocolError: (message) => conversationStore.getState().setError(conversationId, message),
      })
    } catch (error) {
      this.connections.delete(conversationId)
      conversationStore.getState().setError(conversationId, errorMessage(error))
    }
  }
}

export function updateConversationSnapshot(conversation: Conversation): void {
  conversationStore.getState().prepareReplay(conversation)
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message
  return error instanceof Error ? error.message : "The conversation request failed."
}

export const conversationController = new ConversationController()
