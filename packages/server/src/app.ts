import { apiSuccess } from "@agent-weave/contracts"
import cors from "cors"
import express from "express"
import { pinoHttp } from "pino-http"
import { environment } from "./config/index.js"
import { conversationRouter } from "./features/conversations/index.js"
import { errorHandler, getRequestId, notFoundHandler, requestContext } from "./http/index.js"

export function createApp() {
  const app = express()

  app.disable("x-powered-by")
  app.use(requestContext)
  app.use(
    pinoHttp({
      genReqId: (_request, response) => String(response.getHeader("x-request-id")),
    }),
  )
  app.use(cors({ origin: environment.corsOrigins }))
  app.use(express.json({ limit: "1mb" }))

  app.get("/health", (_request, response) => {
    response.json(apiSuccess({ status: "ok" }, getRequestId(response)))
  })
  app.use("/api/v1/conversations", conversationRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

export const app = createApp()
