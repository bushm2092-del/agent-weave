import { randomUUID } from "node:crypto"
import type { TeamEvent, TeamEventType } from "@agent-weave/contracts"
import { teamRepository, type TeamRepository } from "./persistence/index.js"

type EventListener = (event: TeamEvent) => void

export class TeamEventBus {
  private readonly listeners = new Map<string, Set<EventListener>>()
  private readonly transactionBuffers: TeamEvent[][] = []

  constructor(private readonly repository: TeamRepository) {}

  transaction<T>(action: () => T): T {
    const events: TeamEvent[] = []
    this.transactionBuffers.push(events)
    try {
      const result = this.repository.transaction(action)
      this.transactionBuffers.pop()
      const parent = this.transactionBuffers.at(-1)
      if (parent) parent.push(...events)
      else for (const event of events) this.notify(event)
      return result
    } catch (error) {
      this.transactionBuffers.pop()
      throw error
    }
  }

  publish(input: {
    teamId: string
    teamRunId?: string
    slotId?: string
    type: TeamEventType
    data: unknown
  }): TeamEvent {
    const event = this.repository.appendEvent({
      id: randomUUID(),
      teamId: input.teamId,
      ...(input.teamRunId ? { teamRunId: input.teamRunId } : {}),
      ...(input.slotId ? { slotId: input.slotId } : {}),
      type: input.type,
      data: input.data,
      createdAt: new Date().toISOString(),
    })
    const buffer = this.transactionBuffers.at(-1)
    if (buffer) buffer.push(event)
    else this.notify(event)
    return event
  }

  subscribe(teamId: string, listener: EventListener): () => void {
    const listeners = this.listeners.get(teamId) ?? new Set<EventListener>()
    listeners.add(listener)
    this.listeners.set(teamId, listeners)
    return () => {
      listeners.delete(listener)
      if (listeners.size === 0) this.listeners.delete(teamId)
    }
  }

  private notify(event: TeamEvent): void {
    for (const listener of this.listeners.get(event.teamId) ?? []) {
      try {
        listener(event)
      } catch {
        // A disconnected subscriber must not affect persisted Team state.
      }
    }
  }
}

export const teamEventBus = new TeamEventBus(teamRepository)
