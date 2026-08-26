import { isAcpRuntimeError } from "acpx/runtime"
import { ZodError } from "zod"
import { AgentGatewayError } from "../../features/conversations/gateways/agent.gateway.js"
import { ConversationError } from "../../features/conversations/conversation.errors.js"
import { HttpError } from "./http-error.js"

export type MappedHttpError = {
  status: number
  code: string
  message: string
  details?: unknown
}

export function mapHttpError(error: unknown): MappedHttpError {
  if (error instanceof ZodError) {
    return {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "The request payload is invalid.",
      details: error.issues,
    }
  }

  if (error instanceof HttpError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    }
  }

  if (error instanceof ConversationError) {
    return { status: error.status, code: error.code, message: error.message }
  }

  if (error instanceof AgentGatewayError) {
    return {
      status: error.retryable ? 503 : 502,
      code: error.code,
      message: error.message,
      ...(error.detailCode === undefined ? {} : { details: { detailCode: error.detailCode } }),
    }
  }

  if (isAcpRuntimeError(error)) {
    const unavailable = error.code === "ACP_BACKEND_MISSING" || error.code === "ACP_BACKEND_UNAVAILABLE"
    return {
      status: unavailable ? 503 : 502,
      code: error.code,
      message: error.message,
    }
  }

  return { status: 500, code: "INTERNAL_ERROR", message: "An unexpected error occurred." }
}
