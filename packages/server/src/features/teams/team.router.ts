import {
  addTeamMemberRequestSchema,
  apiSuccess,
  createTeamRequestSchema,
  sendTeamMessageRequestSchema,
  updateTeamRequestSchema,
  type TeamEvent,
} from "@agent-weave/contracts"
import { Router, type Request, type Response } from "express"
import { z } from "zod"
import { getRequestId } from "../../http/index.js"
import { TeamError } from "./team.errors.js"
import { decodeTeamMcpRequestId, TEAM_MCP_REQUEST_ID_HEADER } from "./mcp/team-mcp-request-id.js"
import { teamService, type TeamService } from "./team.service.js"

const idSchema = z.string().uuid()
export const TEAM_CONTROL_TOKEN_HEADER = "x-agent-weave-team-control"

export function createTeamRouter(service: TeamService = teamService): Router {
  const router = Router()

  router.post("/", async (request, response) => {
    const data = await service.create(createTeamRequestSchema.parse(request.body))
    response.status(201).json(apiSuccess(data, getRequestId(response)))
  })

  router.get("/", (request, response) => {
    const canvasId = z.string().trim().min(1).max(200).optional().parse(request.query.canvasId)
    response.json(apiSuccess(service.list(canvasId), getRequestId(response)))
  })

  router.get("/:teamId", (request, response) => {
    response.json(apiSuccess(service.get(idSchema.parse(request.params.teamId)), getRequestId(response)))
  })

  router.patch("/:teamId", (request, response) => {
    const teamId = idSchema.parse(request.params.teamId)
    authorizeTeamControl(service, request, teamId)
    const data = service.update(teamId, updateTeamRequestSchema.parse(request.body))
    response.json(apiSuccess(data, getRequestId(response)))
  })

  router.delete("/:teamId", async (request, response) => {
    const teamId = idSchema.parse(request.params.teamId)
    authorizeTeamControl(service, request, teamId)
    await service.delete(teamId)
    response.json(apiSuccess({ teamId, deleted: true }, getRequestId(response)))
  })

  router.get("/:teamId/runs", (request, response) => {
    const data = service.listRuns(idSchema.parse(request.params.teamId))
    response.json(apiSuccess(data, getRequestId(response)))
  })

  router.post("/:teamId/runs/:runId/cancel", async (request, response) => {
    const teamId = idSchema.parse(request.params.teamId)
    authorizeTeamControl(service, request, teamId)
    const data = await service.cancelRun(teamId, idSchema.parse(request.params.runId))
    response.json(apiSuccess(data, getRequestId(response)))
  })

  router.post("/:teamId/messages", (request, response) => {
    const teamId = idSchema.parse(request.params.teamId)
    authorizeTeamControl(service, request, teamId)
    const data = service.sendTeamMessage(teamId, sendTeamMessageRequestSchema.parse(request.body))
    response.status(202).json(apiSuccess(data, getRequestId(response)))
  })

  router.post("/:teamId/members", async (request, response) => {
    const teamId = idSchema.parse(request.params.teamId)
    authorizeTeamControl(service, request, teamId)
    const data = await service.addMember(teamId, addTeamMemberRequestSchema.parse(request.body))
    response.status(201).json(apiSuccess(data, getRequestId(response)))
  })

  router.delete("/:teamId/members/:slotId", async (request, response) => {
    const teamId = idSchema.parse(request.params.teamId)
    const slotId = idSchema.parse(request.params.slotId)
    authorizeTeamControl(service, request, teamId)
    await service.removeMember(teamId, slotId)
    response.json(apiSuccess({ teamId, slotId, removed: true }, getRequestId(response)))
  })

  router.post("/:teamId/spawn-requests/:requestId/approve", async (request, response) => {
    const teamId = idSchema.parse(request.params.teamId)
    authorizeTeamControl(service, request, teamId)
    const data = await service.approveSpawnRequest(teamId, idSchema.parse(request.params.requestId))
    response.status(201).json(apiSuccess(data, getRequestId(response)))
  })

  router.post("/:teamId/spawn-requests/:requestId/reject", async (request, response) => {
    const teamId = idSchema.parse(request.params.teamId)
    authorizeTeamControl(service, request, teamId)
    const data = await service.rejectSpawnRequest(teamId, idSchema.parse(request.params.requestId))
    response.json(apiSuccess(data, getRequestId(response)))
  })

  router.post("/:teamId/members/:slotId/messages", (request, response) => {
    const teamId = idSchema.parse(request.params.teamId)
    authorizeTeamControl(service, request, teamId)
    const data = service.sendMemberMessage(
      teamId,
      idSchema.parse(request.params.slotId),
      sendTeamMessageRequestSchema.parse(request.body),
    )
    response.status(202).json(apiSuccess(data, getRequestId(response)))
  })

  router.get("/:teamId/events", (request, response) => {
    const teamId = idSchema.parse(request.params.teamId)
    const sequence = parseSequence(request.header("last-event-id") ?? request.query.after)
    let cursor = sequence
    let replaying = true
    const bufferedEvents: TeamEvent[] = []
    const unsubscribe = service.subscribe(teamId, (event) => {
      if (replaying) bufferedEvents.push(event)
      else if (event.sequence > cursor) {
        writeEvent(response, event)
        cursor = event.sequence
      }
    })
    let replayEvents: TeamEvent[]
    try {
      replayEvents = service.eventsAfter(teamId, sequence)
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

export function createTeamToolRouter(service: TeamService = teamService): Router {
  const router = Router()
  router.post("/:toolName", async (request, response) => {
    const authorization = request.header("authorization")
    if (!authorization?.startsWith("Bearer ")) {
      throw new TeamError("TEAM_TOOL_UNAUTHORIZED", "Team tool authentication is required.", 401)
    }
    const token = authorization.slice("Bearer ".length).trim()
    const toolName = z.string().trim().min(1).max(100).parse(request.params.toolName)
    const mcpRequestId = decodeTeamMcpRequestId(request.header(TEAM_MCP_REQUEST_ID_HEADER))
    const data = await service.executeTool(token, toolName, request.body, mcpRequestId)
    response.json(apiSuccess(data, getRequestId(response)))
  })
  return router
}

function authorizeTeamControl(service: TeamService, request: Request, teamId: string): void {
  service.authorizeControl(teamId, request.header(TEAM_CONTROL_TOKEN_HEADER))
}

function startEventStream(response: Response): void {
  response.status(200)
  response.setHeader("content-type", "text/event-stream")
  response.setHeader("cache-control", "no-cache, no-transform")
  response.setHeader("connection", "keep-alive")
  response.flushHeaders()
}

function writeEvent(response: Response, event: TeamEvent): void {
  response.write(`id: ${event.sequence}\n`)
  response.write(`event: ${event.type}\n`)
  response.write(`data: ${JSON.stringify(event)}\n\n`)
}

function parseSequence(value: unknown): number {
  if (typeof value !== "string") return 0
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
}

export const teamRouter = createTeamRouter()
export const teamToolRouter = createTeamToolRouter()
