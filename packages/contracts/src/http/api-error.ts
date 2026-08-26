export type ApiError<C extends string = string> = {
  code: C
  message: string
  details?: unknown
}
