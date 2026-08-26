import type { ApiError } from "./api-error.js"

export type ApiMeta = {
  requestId: string
  timestamp: string
}

export type ApiResult<T, C extends string = string> =
  | { ok: true; data: T; meta: ApiMeta }
  | { ok: false; error: ApiError<C>; meta: ApiMeta }

function createMeta(requestId: string): ApiMeta {
  return { requestId, timestamp: new Date().toISOString() }
}

export function apiSuccess<T>(data: T, requestId: string): ApiResult<T, never> {
  return { ok: true, data, meta: createMeta(requestId) }
}

export function apiFailure<C extends string>(
  error: ApiError<C>,
  requestId: string,
): ApiResult<never, C> {
  return { ok: false, error, meta: createMeta(requestId) }
}
