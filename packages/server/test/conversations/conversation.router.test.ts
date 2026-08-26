import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { Conversation } from "@agent-weave/contracts"
import express from "express"
import request from "supertest"
import { createConversationRouter } from "../../src/features/conversations/conversation.router.js"
import type { ConversationServicePort } from "../../src/features/conversations/conversation.models.js"
import { errorHandler, requestContext } from "../../src/http/index.js"

const conversation: Conversation = {
  id: "2ee6db2d-4740-42e2-90fc-36c77f67d4d7",
  agent: "codex",
  workspace: "/tmp",
  status: "initializing",
  sessionState: "pending",
  configOptions: [],
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
}

function createService(): ConversationServicePort {
  return {
    async create() {
      return conversation
    },
    get() {
      return conversation
    },
    listRuns() {
      return []
    },
    async createRun(conversationId, input) {
      return {
        id: "b917f4f9-9d1f-427f-b84c-a726e005b6ef",
        conversationId,
        status: "queued",
        message: input.message,
        attachments: input.attachments,
        assistantText: "",
        thoughtText: "",
        createdAt: "2026-08-26T00:00:00.000Z",
      }
    },
    async setConfigOption() {
      return conversation
    },
    async decidePermission() {},
    async cancelRun() {
      throw new Error("Not used")
    },
    async delete() {},
    eventsAfter() {
      return []
    },
    subscribe() {
      return () => {}
    },
  }
}

function createTestApp(service: ConversationServicePort) {
  const app = express()
  app.use(requestContext)
  app.use(express.json())
  app.use("/api/v1/conversations", createConversationRouter(service))
  app.use(errorHandler)
  return app
}

describe("conversation router", () => {
  it("creates an initializing conversation", async () => {
    const response = await request(createTestApp(createService()))
      .post("/api/v1/conversations")
      .set("x-request-id", "request-123")
      .send({ agent: "codex", workspace: "/tmp" })
      .expect(201)

    assert.equal(response.body.ok, true)
    assert.equal(response.body.data.status, "initializing")
    assert.equal(response.body.meta.requestId, "request-123")
  })

  it("queues a run", async () => {
    const response = await request(createTestApp(createService()))
      .post(`/api/v1/conversations/${conversation.id}/runs`)
      .send({ message: "Hello" })
      .expect(202)

    assert.equal(response.body.data.status, "queued")
    assert.equal(response.body.data.message, "Hello")
  })

  it("returns validation errors using the Result envelope", async () => {
    const response = await request(createTestApp(createService()))
      .post("/api/v1/conversations")
      .send({ agent: "unknown", workspace: "" })
      .expect(400)

    assert.equal(response.body.ok, false)
    assert.equal(response.body.error.code, "VALIDATION_ERROR")
  })
})
