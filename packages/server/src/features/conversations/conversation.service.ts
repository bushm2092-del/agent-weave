import { randomUUID } from "node:crypto"
import { stat } from "node:fs/promises"
import { resolve } from "node:path"
import type { CreateConversationResponse } from "@agent-weave/contracts"
import { ConversationError } from "./conversation.errors.js"
import { createSessionKey, type ConversationServicePort, type SendConversationInput } from "./conversation.models.js"
import { agentGateway, type AgentGateway } from "./gateways/index.js"

export class ConversationService implements ConversationServicePort {
  constructor(private readonly gateway: AgentGateway) {}

  async send(input: SendConversationInput): Promise<CreateConversationResponse> {
    const workspace = resolve(input.workspace)
    await this.assertWorkspace(workspace)

    const conversationId = input.conversationId ?? randomUUID()
    const messageId = randomUUID()
    const result = await this.gateway.sendMessage({
      sessionKey: createSessionKey(conversationId, input.agent),
      requestId: messageId,
      agent: input.agent,
      ...(input.model ? { model: input.model } : {}),
      workspace,
      message: input.message,
      ...(input.signal ? { signal: input.signal } : {}),
    })

    return {
      conversationId,
      messageId,
      agent: input.agent,
      ...(input.model ? { model: input.model } : {}),
      content: result.content,
      ...(result.stopReason ? { stopReason: result.stopReason } : {}),
      ...(result.usage ? { usage: result.usage } : {}),
    }
  }

  private async assertWorkspace(workspace: string): Promise<void> {
    let workspaceStat
    try {
      workspaceStat = await stat(workspace)
    } catch {
      throw new ConversationError("WORKSPACE_NOT_FOUND", "The selected workspace does not exist.", 404)
    }
    if (!workspaceStat.isDirectory()) {
      throw new ConversationError("WORKSPACE_NOT_DIRECTORY", "The selected workspace is not a directory.", 400)
    }
  }
}

export const conversationService: ConversationServicePort = new ConversationService(agentGateway)
