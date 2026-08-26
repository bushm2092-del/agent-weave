function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const environment = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || "/api/v1",
  apiTimeoutMs: positiveNumber(import.meta.env.VITE_API_TIMEOUT_MS, 30_000),
} as const
