import { apiSuccess, createRolePresetRequestSchema, updateRolePresetRequestSchema } from "@agent-weave/contracts"
import { Router } from "express"
import { z } from "zod"
import { getRequestId } from "../../http/index.js"
import { rolePresetService, type RolePresetService } from "./role-preset.service.js"

const idSchema = z.string().uuid()

export function createRolePresetRouter(service: RolePresetService = rolePresetService): Router {
  const router = Router()
  router.get("/", (_request, response) => response.json(apiSuccess(service.list(), getRequestId(response))))
  router.post("/", (request, response) => response.status(201).json(apiSuccess(service.create(createRolePresetRequestSchema.parse(request.body)), getRequestId(response))))
  router.patch("/:presetId", (request, response) => response.json(apiSuccess(service.update(idSchema.parse(request.params.presetId), updateRolePresetRequestSchema.parse(request.body)), getRequestId(response))))
  router.delete("/:presetId", (request, response) => {
    const presetId = idSchema.parse(request.params.presetId)
    service.delete(presetId)
    response.json(apiSuccess({ presetId, deleted: true }, getRequestId(response)))
  })
  return router
}

export const rolePresetRouter = createRolePresetRouter()
