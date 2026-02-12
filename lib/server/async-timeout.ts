export class TimeoutError extends Error {
  readonly timeoutMs: number

  constructor(timeoutMs: number, message?: string) {
    super(message || `Operation timed out after ${timeoutMs}ms`)
    this.name = "TimeoutError"
    this.timeoutMs = timeoutMs
  }
}

export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message?: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(timeoutMs, message)), timeoutMs)
      })
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}
