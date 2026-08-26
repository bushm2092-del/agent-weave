import { randomUUID } from "node:crypto"
import type { ConversationEvent, ConversationEventType } from "@agent-weave/contracts"
import { conversationRepository, type ConversationRepository } from "./persistence/index.js"

type EventListener = (event: ConversationEvent) => void

export class ConversationEventBus {
  private readonly listeners = new Map<string, Set<EventListener>>()

  constructor(private readonly repository: ConversationRepository) {}

  publish(input: {
    conversationId: string
    runId?: string
    type: ConversationEventType
    data: unknown
  }): ConversationEvent {
    const event = this.repository.appendEvent({
      id: randomUUID(),
      conversationId: input.conversationId,
      ...(input.runId ? { runId: input.runId } : {}),
      type: input.type,
      data: input.data,
      createdAt: new Date().toISOString(),
    })
    for (const listener of this.listeners.get(input.conversationId) ?? []) listener(event)
    return event
  }

  subscribe(conversationId: string, listener: EventListener): () => void {
    const listeners = this.listeners.get(conversationId) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(conversationId, listeners)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.listeners.delete(conversationId)
    }
  }
}

export const conversationEventBus = new ConversationEventBus(conversationRepository)
