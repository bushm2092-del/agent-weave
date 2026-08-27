import { apiSuccess, filePathQuerySchema } from "@agent-weave/contracts"
import { Router, type NextFunction, type Request, type Response } from "express"
import { getRequestId } from "../../http/index.js"
import { FileService, fileService } from "./file.service.js"

export function createFileRouter(service: FileService = fileService): Router {
  const router = Router()

  router.get("/list", async (request, response) => {
    const { path } = filePathQuerySchema.parse(request.query)
    const data = await service.list(path)
    response.json(apiSuccess(data, getRequestId(response)))
  })

  router.get("/read", async (request, response) => {
    const { path } = filePathQuerySchema.parse(request.query)
    const data = await service.read(path)
    response.json(apiSuccess(data, getRequestId(response)))
  })

  router.get("/raw", async (request: Request, response: Response, next: NextFunction) => {
    try {
      const { path } = filePathQuerySchema.parse(request.query)
      const image = await service.openRawImage(path)
      if (request.header("if-none-match") === image.etag) {
        await image.file.close()
        response.status(304).end()
        return
      }
      response.status(200)
      response.setHeader("content-type", image.mediaType)
      response.setHeader("content-length", image.size)
      response.setHeader("content-disposition", inlineDisposition(image.name))
      response.setHeader("cache-control", "private, no-cache")
      response.setHeader("etag", image.etag)
      response.setHeader("last-modified", image.modifiedAt.toUTCString())
      response.setHeader("x-content-type-options", "nosniff")
      const stream = image.file.createReadStream({ autoClose: true, start: 0 })
      stream.once("error", (error) => {
        if (response.headersSent) response.destroy(error)
        else next(error)
      })
      request.once("aborted", () => stream.destroy())
      stream.pipe(response)
    } catch (error) {
      next(error)
    }
  })

  return router
}

function inlineDisposition(name: string): string {
  const asciiName = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_")
  return `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

export const fileRouter = createFileRouter()
