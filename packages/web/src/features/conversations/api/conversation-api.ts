import type {
  Conversation,
  CreateConversationRequest,
  CreateRunRequest,
  DecidePermissionRequest,
  Run,
  SetConfigOptionRequest,
} from "@agent-weave/contracts"

import { apiClient } from "@/lib/api"

const conversationsPath = "/conversations"

function conversationPath(conversationId: string): string {
  return `${conversationsPath}/${encodeURIComponent(conversationId)}`
}

export const conversationApi = {
  create(input: CreateConversationRequest): Promise<Conversation> {
    return apiClient.post<Conversation, CreateConversationRequest>(conversationsPath, input)
  },

  get(conversationId: string): Promise<Conversation> {
    return apiClient.get<Conversation>(conversationPath(conversationId))
  },

  delete(conversationId: string): Promise<{ conversationId: string; deleted: boolean }> {
    return apiClient.delete(conversationPath(conversationId))
  },

  listRuns(conversationId: string): Promise<Run[]> {
    return apiClient.get(`${conversationPath(conversationId)}/runs`)
  },

  createRun(conversationId: string, input: CreateRunRequest): Promise<Run> {
    return apiClient.post<Run, CreateRunRequest>(`${conversationPath(conversationId)}/runs`, input)
  },

  cancelRun(conversationId: string, runId: string): Promise<Run> {
    return apiClient.post(`${conversationPath(conversationId)}/runs/${encodeURIComponent(runId)}/cancel`)
  },

  setConfigOption(conversationId: string, configId: string, input: SetConfigOptionRequest): Promise<Conversation> {
    return apiClient.patch<Conversation, SetConfigOptionRequest>(
      `${conversationPath(conversationId)}/config-options/${encodeURIComponent(configId)}`,
      input,
    )
  },

  decidePermission(
    conversationId: string,
    runId: string,
    permissionId: string,
    input: DecidePermissionRequest,
  ): Promise<{ resolved: boolean }> {
    return apiClient.post(
      `${conversationPath(conversationId)}/runs/${encodeURIComponent(runId)}/permissions/${encodeURIComponent(permissionId)}`,
      input,
    )
  },
}
