/**
 * Utilidades para manejo seguro de errores
 * 
 * Centraliza la extracción de mensajes de error y el logging
 * para evitar inconsistencias en toda la aplicación.
 */

export interface ErrorInfo {
  message: string
  code?: string
  stack?: string
  originalError: unknown
}

/**
 * Extrae un mensaje de error seguro de cualquier tipo de valor
 * Nunca devuelve undefined o null, siempre un string descriptivo
 */
export function getErrorMessage(error: unknown, fallback = "Error desconocido"): string {
  // Si es un Error estándar
  if (error instanceof Error) {
    return error.message || fallback
  }
  
  // Si es un string
  if (typeof error === "string") {
    return error || fallback
  }
  
  // Si es un objeto con propiedad message
  if (error && typeof error === "object") {
    const errObj = error as Record<string, unknown>
    
    if (typeof errObj.message === "string" && errObj.message) {
      return errObj.message
    }
    
    // Algunos errores de APIs tienen error o detail
    if (typeof errObj.error === "string" && errObj.error) {
      return errObj.error
    }
    
    if (typeof errObj.detail === "string" && errObj.detail) {
      return errObj.detail
    }
    
    // Intentar convertir a string el objeto
    try {
      const json = JSON.stringify(error)
      if (json && json !== "{}") {
        return json
      }
    } catch {
      // Ignorar errores de stringify
    }
  }
  
  return fallback
}

/**
 * Extrae el código de error de cualquier tipo de valor
 */
export function getErrorCode(error: unknown): string | undefined {
  if (!error) return undefined
  
  if (error instanceof Error) {
    const errWithCode = error as Error & { code?: string }
    return errWithCode.code
  }
  
  if (typeof error === "object") {
    const errObj = error as Record<string, unknown>
    if (typeof errObj.code === "string") {
      return errObj.code
    }
    if (typeof errObj.status === "string" || typeof errObj.status === "number") {
      return String(errObj.status)
    }
  }
  
  return undefined
}

/**
 * Convierte cualquier error en un objeto ErrorInfo estructurado
 */
export function toErrorInfo(error: unknown, fallbackMessage = "Error desconocido"): ErrorInfo {
  return {
    message: getErrorMessage(error, fallbackMessage),
    code: getErrorCode(error),
    stack: error instanceof Error ? error.stack : undefined,
    originalError: error
  }
}

/**
 * Logger de errores estandarizado
 */
export function logError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>
): void {
  const errorInfo = toErrorInfo(error)
  
  console.error(`[${context}] ❌ ERROR:`, {
    message: errorInfo.message,
    code: errorInfo.code,
    ...extra,
    stack: errorInfo.stack?.split("\n").slice(0, 5).join("\n") // Limitar stack
  })
}

/**
 * Logger de warnings estandarizado
 */
export function logWarning(
  context: string,
  message: string,
  extra?: Record<string, unknown>
): void {
  console.warn(`[${context}] ⚠️ WARNING:`, message, extra)
}

/**
 * Verifica si un error es una cancelación de usuario
 */
export function isCancellationError(error: unknown): boolean {
  if (!error) return false
  
  // Verificar nombre
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "CancelledError") {
      return true
    }
  }
  
  // Verificar código
  const code = getErrorCode(error)
  if (code === "CANCELLED" || code === "ABORTED") {
    return true
  }
  
  // Verificar mensaje
  const message = getErrorMessage(error, "").toLowerCase()
  return message.includes("cancel") || message.includes("abort")
}

/**
 * Verifica si un error es un timeout
 */
export function isTimeoutError(error: unknown): boolean {
  if (!error) return false
  
  const code = getErrorCode(error)
  if (code === "TIMEOUT" || code === "ETIMEDOUT") {
    return true
  }
  
  const message = getErrorMessage(error, "").toLowerCase()
  return message.includes("timeout") || message.includes("timed out")
}
