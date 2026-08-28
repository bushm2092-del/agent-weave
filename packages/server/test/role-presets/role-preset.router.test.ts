import assert from "node:assert/strict"
import { DatabaseSync } from "node:sqlite"
import { describe, it } from "node:test"
import express from "express"
import request from "supertest"
import { RolePresetRepository } from "../../src/features/role-presets/role-preset.repository.js"
import { createRolePresetRouter } from "../../src/features/role-presets/role-preset.router.js"
import { RolePresetService } from "../../src/features/role-presets/role-preset.service.js"
import { errorHandler, requestContext } from "../../src/http/index.js"

function createHarness() {
  const database = new DatabaseSync(":memory:")
  const service = new RolePresetService(new RolePresetRepository(database))
  const app = express()
  app.use(requestContext)
  app.use(express.json())
  app.use("/api/v1/role-presets", createRolePresetRouter(service))
  app.use(errorHandler)
  return { app, service }
}

describe("role preset router", () => {
  it("seeds built-in presets and manages a custom preset", async () => {
    const { app } = createHarness()
    const initial = await request(app).get("/api/v1/role-presets").expect(200)
    assert.equal(initial.body.data.length, 4)
    assert.equal(initial.body.data.every((preset: { builtIn: boolean }) => preset.builtIn), true)

    const created = await request(app).post("/api/v1/role-presets").send({
      name: "Security reviewer",
      description: "Reviews changes for security risks.",
      category: "Review",
      agent: "codex",
      systemPrompt: "Identify trust boundaries, attack paths, and concrete mitigations.",
    }).expect(201)
    assert.equal(created.body.data.builtIn, false)

    const presetId = created.body.data.id as string
    const updated = await request(app).patch(`/api/v1/role-presets/${presetId}`).send({ name: "AppSec reviewer" }).expect(200)
    assert.equal(updated.body.data.name, "AppSec reviewer")

    await request(app).delete(`/api/v1/role-presets/${presetId}`).expect(200)
    const final = await request(app).get("/api/v1/role-presets").expect(200)
    assert.equal(final.body.data.length, 4)
  })

  it("protects built-in presets from deletion", async () => {
    const { app, service } = createHarness()
    await request(app).delete(`/api/v1/role-presets/${service.list()[0]!.id}`).expect(409)
  })
})
