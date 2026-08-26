import {
  apiSuccess,
  createConversationRequestSchema,
  createRunRequestSchema,
  decidePermissionRequestSchema,
  setConfigOptionRequestSchema,
  type ConversationEvent,
} from "@agent-weave/contracts"
import { Router, type Response } from "express"
import { z } from "zod"
import { getRequestId } from "../../http/index.js"
import type { ConversationServicePort } from "./conversation.models.js"
import { conversationService } from "./conversation.service.js"

const idSchema = z.string().uuid()

export function createConversationRouter(service: ConversationServicePort = conversationService): Router {
  const router = Router()

  router.post("/", async (request, response) => {
    const data = await service.create(createConversationRequestSchema.parse(request.body))
    response.status(201).json(apiSuccess(data, getRequestId(response)))
  })

  router.get("/:conversationId", (request, response) => {
    const data = service.get(idSchema.parse(request.params.conversationId))
    response.json(apiSuccess(data, getRequestId(response)))
  })

  router.delete("/:conversationId", async (request, response) => {
    const conversationId = idSchema.parse(request.params.conversationId)
    await service.delete(conversationId)
    response.json(apiSuccess({ conversationId, deleted: true }, getRequestId(response)))
  })

  router.get("/:conversationId/runs", (request, response) => {
    const data = service.listRuns(idSchema.parse(request.params.conversationId))
    response.json(apiSuccess(data, getRequestId(response)))
  })

  router.post("/:conversationId/runs", async (request, response) => {
    const conversationId = idSchema.parse(request.params.conversationId)
    const data = await service.createRun(conversationId, createRunRequestSchema.parse(request.body))
    response.status(202).json(apiSuccess(data, getRequestId(response)))
  })

  router.post("/:conversationId/runs/:runId/cancel", async (request, response) => {
    const data = await service.cancelRun(
      idSchema.parse(request.params.conversationId),
      idSchema.parse(request.params.runId),
    )
    response.json(apiSuccess(data, getRequestId(response)))
  })

  router.post("/:conversationId/runs/:runId/permissions/:permissionId", async (request, response) => {
    const { optionId } = decidePermissionRequestSchema.parse(request.body)
    await service.decidePermission(
      idSchema.parse(request.params.conversationId),
      idSchema.parse(request.params.runId),
      idSchema.parse(request.params.permissionId),
      optionId,
    )
    response.json(apiSuccess({ resolved: true }, getRequestId(response)))
  })

  router.patch("/:conversationId/config-options/:configId", async (request, response) => {
    const data = await service.setConfigOption(
      idSchema.parse(request.params.conversationId),
      request.params.configId,
      setConfigOptionRequestSchema.parse(request.body),
    )
    response.json(apiSuccess(data, getRequestId(response)))
  })

  router.get("/:conversationId/events", (request, response) => {
    const conversationId = idSchema.parse(request.params.conversationId)
    const sequence = parseSequence(request.header("last-event-id") ?? request.query.after)
    let cursor = sequence
    let replaying = true
    const bufferedEvents: ConversationEvent[] = []
    const unsubscribe = service.subscribe(conversationId, (event) => {
      if (replaying) {
        bufferedEvents.push(event)
      } else if (event.sequence > cursor) {
        writeEvent(response, event)
        cursor = event.sequence
      }
    })
    let replayEvents: ConversationEvent[]
    try {
      replayEvents = service.eventsAfter(conversationId, sequence)
    } catch (error) {
      unsubscribe()
      throw error
    }
    startEventStream(response)
    for (const event of replayEvents) {
      if (event.sequence <= cursor) continue
      writeEvent(response, event)
      cursor = event.sequence
    }
    replaying = false
    for (const event of bufferedEvents) {
      if (event.sequence <= cursor) continue
      writeEvent(response, event)
      cursor = event.sequence
    }
    const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 15_000)
    request.once("close", () => {
      clearInterval(heartbeat)
      unsubscribe()
      response.end()
    })
  })

  return router
}

function startEventStream(response: Response): void {
  response.status(200)
  response.setHeader("content-type", "text/event-stream")
  response.setHeader("cache-control", "no-cache, no-transform")
  response.setHeader("connection", "keep-alive")
  response.flushHeaders()
}

function writeEvent(response: Response, event: ConversationEvent): void {
  response.write(`id: ${event.sequence}\n`)
  response.write(`event: ${event.type}\n`)
  response.write(`data: ${JSON.stringify(event)}\n\n`)
}

function parseSequence(value: unknown): number {
  if (typeof value !== "string") return 0
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
}

export const conversationRouter = createConversationRouter()
