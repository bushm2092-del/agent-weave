import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, describe, it } from "node:test"
import { DatabaseSync } from "node:sqlite"
import express from "express"
import request from "supertest"
import { ConversationEventBus } from "../../src/features/conversations/conversation-event-bus.js"
import { ConversationService } from "../../src/features/conversations/conversation.service.js"
import type { AgentGateway } from "../../src/features/conversations/gateways/agent.gateway.js"
import { SqliteConversationRepository } from "../../src/features/conversations/persistence/sqlite-conversation.repository.js"
import { TeamEventBus } from "../../src/features/teams/team-event-bus.js"
import { encodeTeamMcpRequestId, TEAM_MCP_REQUEST_ID_HEADER } from "../../src/features/teams/mcp/team-mcp-request-id.js"
import { SqliteTeamRepository } from "../../src/features/teams/persistence/sqlite-team.repository.js"
import {
  createTeamRouter,
  createTeamToolRouter,
  TEAM_CONTROL_TOKEN_HEADER,
} from "../../src/features/teams/team.router.js"
import { TeamService } from "../../src/features/teams/team.service.js"
import { errorHandler, requestContext } from "../../src/http/index.js"

describe("team router", () => {
  let workspace = ""
  let service: TeamService
  let repository: SqliteTeamRepository
  let app: express.Express

  before(async () => {
    workspace = await mkdtemp(join(tmpdir(), "agent-weave-team-router-"))
    const database = new DatabaseSync(":memory:")
    const conversationRepository = new SqliteConversationRepository(database)
    repository = new SqliteTeamRepository(database)
    const conversations = new ConversationService(
      createGateway(),
      conversationRepository,
      new ConversationEventBus(conversationRepository),
    )
    service = new TeamService(repository, conversations, new TeamEventBus(repository))
    app = express()
    app.use(requestContext)
    app.use(express.json())
    app.use("/api/v1/teams", createTeamRouter(service))
    app.use("/api/v1/internal/team-tools", createTeamToolRouter(service))
    app.use(errorHandler)
  })

  after(async () => rm(workspace, { recursive: true, force: true }))

  it("creates, lists, and queues a team goal through the Result envelope", async () => {
    const created = await request(app)
      .post("/api/v1/teams")
      .set("x-request-id", "team-request")
      .send({
        canvasId: "router-canvas",
        name: "Router team",
        workspace,
        leader: { name: "Lead", agent: "codex" },
      })
      .expect(201)

    assert.equal(created.body.ok, true)
    assert.equal(created.body.meta.requestId, "team-request")
    assert.equal(created.body.data.members.length, 1)
    assert.equal(typeof created.body.data.controlToken, "string")

    const listed = await request(app).get("/api/v1/teams?canvasId=router-canvas").expect(200)
    assert.equal(listed.body.data.length, 1)
    assert.equal(listed.body.data[0].controlToken, undefined)

    await request(app)
      .post(`/api/v1/teams/${created.body.data.id}/messages`)
      .send({ message: "Bypass host control" })
      .expect(401)

    const receipt = await request(app)
      .post(`/api/v1/teams/${created.body.data.id}/messages`)
      .set(TEAM_CONTROL_TOKEN_HEADER, created.body.data.controlToken)
      .send({ message: "Ship the change" })
      .expect(202)
    assert.equal(receipt.body.data.status, "queued")
  })

  it("requires a member token for internal tools", async () => {
    const team = service.list("router-canvas")[0]!
    await request(app).post("/api/v1/internal/team-tools/team_members").send({}).expect(401)

    const leader = repository.getMember(team.id, team.leaderSlotId)!
    await request(app)
      .patch(`/api/v1/teams/${team.id}`)
      .set(TEAM_CONTROL_TOKEN_HEADER, leader.mcpToken)
      .send({ name: "MCP bypass" })
      .expect(401)
    const response = await request(app)
      .post("/api/v1/internal/team-tools/team_members")
      .set("authorization", `Bearer ${leader.mcpToken}`)
      .send({})
      .expect(200)
    assert.equal(response.body.data[0].name, "Lead")
    assert.equal(response.body.data[0].mcpToken, undefined)
  })

  it("deduplicates mutating tools by the MCP request ID header", async () => {
    const team = service.list("router-canvas")[0]!
    const leader = repository.getMember(team.id, team.leaderSlotId)!
    const first = await request(app)
      .post("/api/v1/internal/team-tools/team_task_create")
      .set("authorization", `Bearer ${leader.mcpToken}`)
      .set(TEAM_MCP_REQUEST_ID_HEADER, encodeTeamMcpRequestId(73))
      .send({ subject: "Original router task" })
      .expect(200)
    const retried = await request(app)
      .post("/api/v1/internal/team-tools/team_task_create")
      .set("authorization", `Bearer ${leader.mcpToken}`)
      .set(TEAM_MCP_REQUEST_ID_HEADER, encodeTeamMcpRequestId(73))
      .send({ subject: "Changed retry payload" })
      .expect(200)

    assert.deepEqual(retried.body.data, first.body.data)
    assert.equal(repository.listTasks(team.id).filter((task) => task.subject.includes("router")).length, 1)
  })
})

function createGateway(): AgentGateway {
  return {
    async initializeSession() {
      return { state: "created", configOptions: [] }
    },
    async getConfigOptions() {
      return []
    },
    async setConfigOption() {
      return []
    },
    async run(input) {
      await input.emit({ type: "assistant.delta", data: { text: "Done" } })
      return { content: "Done", configOptions: [] }
    },
    async decidePermission() {},
    async cancelRun() {},
    async closeSession() {},
  }
}
