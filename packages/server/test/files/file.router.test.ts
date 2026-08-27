import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, it } from "node:test"
import express from "express"
import request from "supertest"
import { createFileRouter } from "../../src/features/files/file.router.js"
import { FileService } from "../../src/features/files/file.service.js"
import { errorHandler, requestContext } from "../../src/http/index.js"

const temporaryDirectories: string[] = []
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
])

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

function createTestApp() {
  const app = express()
  app.use(requestContext)
  app.use("/api/v1/files", createFileRouter(new FileService()))
  app.use(errorHandler)
  return app
}

async function createDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "agent-weave-files-"))
  temporaryDirectories.push(path)
  return path
}

describe("file router", () => {
  it("lists one directory level with directories first and preview metadata", async () => {
    const directory = await createDirectory()
    await mkdir(join(directory, "packages"))
    await writeFile(join(directory, "package.json"), '{\n  "name": "example"\n}\n')
    await writeFile(join(directory, "logo.png"), png)

    const response = await request(createTestApp()).get("/api/v1/files/list").query({ path: directory }).expect(200)

    assert.equal(response.body.ok, true)
    assert.equal(response.body.data.path, directory)
    assert.deepEqual(
      response.body.data.entries.map((entry: { name: string }) => entry.name),
      ["packages", "logo.png", "package.json"],
    )
    assert.deepEqual(
      response.body.data.entries.map((entry: { previewType: string }) => entry.previewType),
      ["unsupported", "image", "text"],
    )
  })

  it("returns UTF-8 text through the Result envelope", async () => {
    const directory = await createDirectory()
    const filePath = join(directory, "README.md")
    await writeFile(filePath, "# AgentWeave\n\n文件内容\n")

    const response = await request(createTestApp()).get("/api/v1/files/read").query({ path: filePath }).expect(200)

    assert.equal(response.body.data.path, filePath)
    assert.equal(response.body.data.content, "# AgentWeave\n\n文件内容\n")
    assert.equal(response.body.data.encoding, "utf-8")
    assert.equal(response.body.data.mimeType, "text/markdown")
  })

  it("streams supported images and honors conditional requests", async () => {
    const directory = await createDirectory()
    const filePath = join(directory, "logo.dat")
    await writeFile(filePath, png)

    const firstResponse = await request(createTestApp()).get("/api/v1/files/raw").query({ path: filePath }).expect(200)

    const contentType = firstResponse.headers["content-type"]
    const etag = firstResponse.headers.etag
    assert.ok(contentType)
    assert.ok(etag)
    assert.match(contentType, /^image\/png/)
    assert.equal(firstResponse.headers["x-content-type-options"], "nosniff")
    assert.deepEqual(firstResponse.body, png)

    await request(createTestApp())
      .get("/api/v1/files/raw")
      .query({ path: filePath })
      .set("if-none-match", etag)
      .expect(304)
  })

  it("rejects relative paths and binary text reads with structured errors", async () => {
    const relativeResponse = await request(createTestApp())
      .get("/api/v1/files/list")
      .query({ path: "packages" })
      .expect(400)
    assert.equal(relativeResponse.body.error.code, "FILE_PATH_NOT_ABSOLUTE")

    const directory = await createDirectory()
    const filePath = join(directory, "binary.bin")
    await writeFile(filePath, Buffer.from([0x00, 0xff, 0x01]))
    const binaryResponse = await request(createTestApp())
      .get("/api/v1/files/read")
      .query({ path: filePath })
      .expect(415)
    assert.equal(binaryResponse.body.error.code, "UNSUPPORTED_FILE_TYPE")
  })

  it("rejects oversized text files", async () => {
    const directory = await createDirectory()
    const filePath = join(directory, "large.txt")
    await writeFile(filePath, Buffer.alloc(2 * 1024 * 1024 + 1, 0x61))

    const response = await request(createTestApp()).get("/api/v1/files/read").query({ path: filePath }).expect(413)

    assert.equal(response.body.error.code, "FILE_TOO_LARGE")
  })
})
