import { apiSuccess, createConversationRequestSchema } from "@agent-weave/contracts"
import { Router } from "express"
import { getRequestId } from "../../http/index.js"
import type { ConversationServicePort } from "./conversation.models.js"
import { conversationService } from "./conversation.service.js"

export function createConversationRouter(service: ConversationServicePort = conversationService): Router {
  const router = Router()

  router.post("/", async (request, response) => {
    const input = createConversationRequestSchema.parse(request.body)
    const abortController = new AbortController()
    const abort = () => abortController.abort("HTTP request aborted")
    request.once("aborted", abort)

    try {
      const data = await service.send({ ...input, signal: abortController.signal })
      response.status(input.conversationId ? 200 : 201).json(apiSuccess(data, getRequestId(response)))
    } finally {
      request.off("aborted", abort)
    }
  })

  return router
}

export const conversationRouter = createConversationRouter()
