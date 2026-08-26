import assert from "node:assert/strict"
import { describe, it } from "node:test"
import express from "express"
import request from "supertest"
import { createConversationRouter } from "../../src/features/conversations/conversation.router.js"
import type { ConversationServicePort } from "../../src/features/conversations/conversation.models.js"
import { errorHandler, requestContext } from "../../src/http/index.js"

function createTestApp(service: ConversationServicePort) {
  const app = express()
  app.use(requestContext)
  app.use(express.json())
  app.use("/api/v1/conversations", createConversationRouter(service))
  app.use(errorHandler)
  return app
}

describe("POST /api/v1/conversations", () => {
  it("returns a Result-style success envelope", async () => {
    const service: ConversationServicePort = {
      async send(input) {
        return {
          conversationId: "2ee6db2d-4740-42e2-90fc-36c77f67d4d7",
          messageId: "b917f4f9-9d1f-427f-b84c-a726e005b6ef",
          agent: input.agent,
          content: "Hello from Codex",
        }
      },
    }

    const response = await request(createTestApp(service))
      .post("/api/v1/conversations")
      .set("x-request-id", "request-123")
      .send({ agent: "codex", workspace: "/tmp", message: "Hello" })
      .expect(201)

    assert.equal(response.body.ok, true)
    assert.equal(response.body.data.content, "Hello from Codex")
    assert.equal(response.body.meta.requestId, "request-123")
  })

  it("returns validation errors in the same envelope", async () => {
    const service: ConversationServicePort = {
      async send() {
        throw new Error("Service should not be called")
      },
    }

    const response = await request(createTestApp(service))
      .post("/api/v1/conversations")
      .send({ agent: "unknown", workspace: "", message: "" })
      .expect(400)

    assert.equal(response.body.ok, false)
    assert.equal(response.body.error.code, "VALIDATION_ERROR")
    assert.ok(Array.isArray(response.body.error.details))
  })
})
