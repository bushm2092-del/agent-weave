import type { ApiResult } from "@agent-weave/contracts"
import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios"

import { environment } from "@/config/env"
import { ApiClientError } from "@/lib/api/api-client-error"

type RequestConfig = Omit<AxiosRequestConfig, "data" | "method" | "url">

class ApiClient {
  readonly instance: AxiosInstance

  constructor() {
    this.instance = axios.create({
      baseURL: environment.apiBaseUrl,
      timeout: environment.apiTimeoutMs,
      headers: { Accept: "application/json" },
    })
    this.instance.interceptors.request.use((config) => {
      if (!config.headers.has("x-request-id")) {
        config.headers.set("x-request-id", crypto.randomUUID())
      }
      return config
    })
  }

  get<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "GET", url })
  }

  post<T, TBody = unknown>(url: string, data?: TBody, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "POST", url, data })
  }

  patch<T, TBody = unknown>(url: string, data?: TBody, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "PATCH", url, data })
  }

  delete<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: "DELETE", url })
  }

  async request<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.instance.request<ApiResult<T>>(config)
      return unwrapResult(response.data, response.status)
    } catch (error) {
      throw normalizeError(error)
    }
  }
}

function unwrapResult<T>(result: ApiResult<T>, status: number): T {
  if (!isApiResult(result)) {
    throw new ApiClientError({
      code: "INVALID_API_RESPONSE",
      message: "The server returned an invalid response.",
      status,
    })
  }
  if (result.ok) return result.data
  throw new ApiClientError({
    code: result.error.code,
    message: result.error.message,
    status,
    requestId: result.meta.requestId,
    details: result.error.details,
  })
}

function normalizeError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) return error
  if (!(error instanceof AxiosError)) {
    return new ApiClientError({
      code: "UNKNOWN_REQUEST_ERROR",
      message: error instanceof Error ? error.message : "The request failed.",
      cause: error,
    })
  }

  const result = error.response?.data
  if (isApiResult(result) && !result.ok) {
    return new ApiClientError({
      code: result.error.code,
      message: result.error.message,
      status: error.response?.status,
      requestId: result.meta.requestId,
      details: result.error.details,
      cause: error,
    })
  }
  if (error.code === AxiosError.ERR_CANCELED) {
    return new ApiClientError({ code: "REQUEST_CANCELLED", message: "The request was cancelled.", cause: error })
  }
  if (error.code === AxiosError.ECONNABORTED) {
    return new ApiClientError({ code: "REQUEST_TIMEOUT", message: "The request timed out.", cause: error })
  }
  if (!error.response) {
    return new ApiClientError({
      code: "NETWORK_ERROR",
      message: "Unable to reach the AgentWeave server.",
      cause: error,
    })
  }
  return new ApiClientError({
    code: "HTTP_ERROR",
    message: `The server returned HTTP ${error.response.status}.`,
    status: error.response.status,
    cause: error,
  })
}

function isApiResult(value: unknown): value is ApiResult<unknown> {
  if (!value || typeof value !== "object") return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.ok === "boolean" && !!candidate.meta && typeof candidate.meta === "object"
}

export const apiClient = new ApiClient()
