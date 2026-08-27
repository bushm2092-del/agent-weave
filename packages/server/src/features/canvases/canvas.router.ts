import {
  apiSuccess,
  createCanvasRequestSchema,
  saveCanvasSnapshotRequestSchema,
  updateCanvasRequestSchema,
} from "@agent-weave/contracts"
import { Router } from "express"
import { z } from "zod"
import { getRequestId } from "../../http/index.js"
import { canvasService, type CanvasService } from "./canvas.service.js"

const canvasIdSchema = z.string().trim().min(1).max(200)

export function createCanvasRouter(service: CanvasService = canvasService): Router {
  const router = Router()

  router.get("/", (_request, response) => {
    response.json(apiSuccess(service.list(), getRequestId(response)))
  })

  router.post("/", (request, response) => {
    const canvas = service.create(createCanvasRequestSchema.parse(request.body))
    response.status(201).json(apiSuccess(canvas, getRequestId(response)))
  })

  router.get("/:canvasId/snapshot", (request, response) => {
    const snapshot = service.getSnapshot(canvasIdSchema.parse(request.params.canvasId))
    response.json(apiSuccess(snapshot, getRequestId(response)))
  })

  router.put("/:canvasId/snapshot", (request, response) => {
    const snapshot = service.saveSnapshot(
      canvasIdSchema.parse(request.params.canvasId),
      saveCanvasSnapshotRequestSchema.parse(request.body),
    )
    response.json(apiSuccess(snapshot, getRequestId(response)))
  })

  router.get("/:canvasId", (request, response) => {
    response.json(apiSuccess(service.get(canvasIdSchema.parse(request.params.canvasId)), getRequestId(response)))
  })

  router.patch("/:canvasId", (request, response) => {
    const canvas = service.update(
      canvasIdSchema.parse(request.params.canvasId),
      updateCanvasRequestSchema.parse(request.body),
    )
    response.json(apiSuccess(canvas, getRequestId(response)))
  })

  router.delete("/:canvasId", async (request, response) => {
    const canvasId = canvasIdSchema.parse(request.params.canvasId)
    await service.delete(canvasId)
    response.json(apiSuccess({ canvasId, deleted: true }, getRequestId(response)))
  })

  return router
}

export const canvasRouter = createCanvasRouter()
