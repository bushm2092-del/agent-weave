import { apiFailure } from "@agent-weave/contracts"
import type { ErrorRequestHandler } from "express"
import { mapHttpError } from "../errors/error-mapper.js"
import { getRequestId } from "./request-context.js"

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const mappedError = mapHttpError(error)
  const requestId = getRequestId(response)

  if (mappedError.status >= 500) {
    request.log?.error({ err: error, requestId }, "Request failed")
  }

  response.status(mappedError.status).json(
    apiFailure(
      {
        code: mappedError.code,
        message: mappedError.message,
        ...(mappedError.details === undefined ? {} : { details: mappedError.details }),
      },
      requestId,
    ),
  )
}
