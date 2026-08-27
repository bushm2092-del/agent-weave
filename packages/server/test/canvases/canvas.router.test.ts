import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { DatabaseSync } from "node:sqlite"
import express from "express"
import request from "supertest"
import { createCanvasRouter } from "../../src/features/canvases/canvas.router.js"
import { CanvasService, type CanvasTeamPort } from "../../src/features/canvases/canvas.service.js"
import { SqliteCanvasRepository } from "../../src/features/canvases/persistence/sqlite-canvas.repository.js"
import { errorHandler, requestContext } from "../../src/http/index.js"

describe("canvas router", () => {
  it("creates, updates, persists, lists, and deletes a canvas", async () => {
    const database = new DatabaseSync(":memory:")
    database.exec("PRAGMA foreign_keys = ON;")
    const teams = createTeamPort()
    const service = new CanvasService(new SqliteCanvasRepository(database), teams)
    const app = express()
    app.use(requestContext)
    app.use(express.json())
    app.use("/api/v1/canvases", createCanvasRouter(service))
    app.use(errorHandler)

    const created = await request(app)
      .post("/api/v1/canvases")
      .send({ name: "HTTP canvas", description: "Stored in SQLite", accent: "orange" })
      .expect(201)
    const canvasId = String(created.body.data.id)
    assert.equal(created.body.data.name, "HTTP canvas")
    assert.equal(created.body.data.agents, 0)

    await request(app)
      .put(`/api/v1/canvases/${canvasId}/snapshot`)
      .send({
        document: {
          store: {
            "shape:agent": { id: "shape:agent", typeName: "shape", type: "agent" },
            "shape:note": { id: "shape:note", typeName: "shape", type: "note" },
          },
          schema: { schemaVersion: 2, sequences: {} },
        },
      })
      .expect(200)

    const listed = await request(app).get("/api/v1/canvases").expect(200)
    assert.equal(listed.body.data.length, 1)
    assert.equal(listed.body.data[0].agents, 1)

    const snapshot = await request(app).get(`/api/v1/canvases/${canvasId}/snapshot`).expect(200)
    assert.equal(snapshot.body.data.document.store["shape:agent"].type, "agent")

    const updated = await request(app)
      .patch(`/api/v1/canvases/${canvasId}`)
      .send({ name: "Renamed canvas" })
      .expect(200)
    assert.equal(updated.body.data.name, "Renamed canvas")

    await request(app).delete(`/api/v1/canvases/${canvasId}`).expect(200)
    await request(app).get(`/api/v1/canvases/${canvasId}`).expect(404)
  })

  it("validates canvas payloads", async () => {
    const service = new CanvasService(new SqliteCanvasRepository(new DatabaseSync(":memory:")), createTeamPort())
    const app = express()
    app.use(requestContext)
    app.use(express.json())
    app.use("/api/v1/canvases", createCanvasRouter(service))
    app.use(errorHandler)

    await request(app).post("/api/v1/canvases").send({ name: "" }).expect(400)
  })
})

function createTeamPort(): CanvasTeamPort {
  return {
    list: () => [],
    async delete() {},
  }
}
