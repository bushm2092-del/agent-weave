export type ApiClientErrorOptions = {
  code: string
  message: string
  status?: number
  requestId?: string
  details?: unknown
  cause?: unknown
}

export class ApiClientError extends Error {
  readonly code: string
  readonly status?: number
  readonly requestId?: string
  readonly details?: unknown

  constructor(options: ApiClientErrorOptions) {
    super(options.message, { cause: options.cause })
    this.name = "ApiClientError"
    this.code = options.code
    this.status = options.status
    this.requestId = options.requestId
    this.details = options.details
  }
}
