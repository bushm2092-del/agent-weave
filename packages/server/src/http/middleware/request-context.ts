import { randomUUID } from "node:crypto"
import type { NextFunction, Request, Response } from "express"

const requestIdPattern = /^[a-zA-Z0-9._:-]{1,128}$/

export function requestContext(request: Request, response: Response, next: NextFunction): void {
  const suppliedRequestId = request.header("x-request-id")
  const requestId = suppliedRequestId && requestIdPattern.test(suppliedRequestId)
    ? suppliedRequestId
    : randomUUID()

  response.locals.requestId = requestId
  response.setHeader("x-request-id", requestId)
  next()
}

export function getRequestId(response: Response): string {
  return typeof response.locals.requestId === "string" ? response.locals.requestId : randomUUID()
}
