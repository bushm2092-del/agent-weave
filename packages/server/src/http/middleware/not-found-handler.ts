import { apiFailure } from "@agent-weave/contracts"
import type { RequestHandler } from "express"
import { getRequestId } from "./request-context.js"

export const notFoundHandler: RequestHandler = (_request, response) => {
  const requestId = getRequestId(response)
  response
    .status(404)
    .json(apiFailure({ code: "NOT_FOUND", message: "The requested endpoint does not exist." }, requestId))
}
