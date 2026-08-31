import type { Conversation, ConversationEvent, Run } from "@agent-weave/contracts"
import { create } from "zustand"
import { immer } from "zustand/middleware/immer"

import type { ConversationConnectionStatus, ConversationView } from "@/features/conversations/conversation-view.types"
import { applyConversationEvent } from "@/features/conversations/store/apply-conversation-event"
import type { PresentableError } from "@/i18n"

type ConversationStore = {
  conversations: Record<string, ConversationView>
  prepareReplay: (conversation: Conversation, runs?: Run[]) => void
  applyEvent: (event: ConversationEvent) => void
  applyEvents: (events: ConversationEvent[]) => void
  upsertRun: (run: Run) => void
  setConnectionStatus: (conversationId: string, status: ConversationConnectionStatus) => void
  setError: (conversationId: string, error?: PresentableError) => void
  remove: (conversationId: string) => void
}

function emptyView(): ConversationView {
  return {
    runs: [],
    toolsByRun: {},
    partsByRun: {},
    pendingPermissions: {},
    lastSequence: 0,
    connectionStatus: "idle",
    loading: true,
  }
}

export const useConversationStore = create<ConversationStore>()(
  immer((set) => ({
    conversations: {},
    prepareReplay: (conversation, runs = []) => {
      set((state) => {
        const current = state.conversations[conversation.id]
        if (current?.lastSequence) {
          current.conversation = conversation
          current.loading = false
          return
        }
        state.conversations[conversation.id] = {
          ...emptyView(),
          conversation,
          runs,
          connectionStatus: "connecting",
          loading: false,
        }
      })
    },
    applyEvent: (event) => {
      set((state) => {
        if (event.type === "conversation.deleted") {
          delete state.conversations[event.conversationId]
          return
        }
        const view = (state.conversations[event.conversationId] ??= emptyView())
        applyConversationEvent(view, event)
      })
    },
    applyEvents: (events) => {
      if (!events.length) return
      set((state) => {
        for (const event of events) {
          if (event.type === "conversation.deleted") {
            delete state.conversations[event.conversationId]
            continue
          }
          const view = (state.conversations[event.conversationId] ??= emptyView())
          applyConversationEvent(view, event)
        }
      })
    },
    upsertRun: (run) => {
      set((state) => {
        const view = (state.conversations[run.conversationId] ??= emptyView())
        const index = view.runs.findIndex((item) => item.id === run.id)
        if (index === -1) view.runs.push(run)
        else view.runs[index] = run
      })
    },
    setConnectionStatus: (conversationId, status) => {
      set((state) => {
        const view = (state.conversations[conversationId] ??= emptyView())
        view.connectionStatus = status
      })
    },
    setError: (conversationId, error) => {
      set((state) => {
        const view = (state.conversations[conversationId] ??= emptyView())
        view.error = error
        view.loading = false
      })
    },
    remove: (conversationId) => {
      set((state) => {
        delete state.conversations[conversationId]
      })
    },
  })),
)

export const conversationStore = useConversationStore
