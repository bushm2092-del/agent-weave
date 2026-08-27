export class CanvasError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "CanvasError"
  }
}
