/**
 * Auth Refresh Token Deduplication
 * 
 * Prevents multiple concurrent refresh token requests that cause
 * "refresh_token_not_found" errors when the same token is used multiple times.
 */

import { isSupabaseRefreshTokenNotFound } from "./auth-errors"

// Global lock for refresh operations
let refreshPromise: Promise<{ data: { session: any }; error: any }> | null = null
let lastRefreshTime = 0
const MIN_REFRESH_INTERVAL_MS = 5000 // Minimum time between refresh attempts

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== "undefined"
}

/**
 * Get a unique key for the current session context
 * This helps prevent cross-tab interference
 */
function getSessionContextKey(): string {
  if (!isBrowser()) return "server"
  
  // Use session storage to get a tab-specific context
  try {
    let tabId = sessionStorage.getItem("ali_tab_id")
    if (!tabId) {
      tabId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      sessionStorage.setItem("ali_tab_id", tabId)
    }
    return tabId
  } catch {
    return "browser"
  }
}

/**
 * Deduplicated session refresh wrapper
 * 
 * This function ensures that only one refresh request is in flight at a time,
 * preventing the "refresh_token_not_found" error that occurs when multiple
 * concurrent requests try to use the same refresh token.
 */
export async function dedupedSessionRefresh(
  refreshFn: () => Promise<{ data: { session: any }; error: any }>
): Promise<{ data: { session: any }; error: any }> {
  const now = Date.now()
  const contextKey = getSessionContextKey()
  
  // If there's a refresh in progress, wait for it
  if (refreshPromise) {
    console.log("[auth-refresh-dedupe] Refresh already in progress, waiting...")
    try {
      const result = await refreshPromise
      return result
    } catch (error) {
      // If the in-flight refresh failed, continue to try a new one
      console.log("[auth-refresh-dedupe] In-flight refresh failed, will retry")
    }
  }
  
  // Throttle refresh attempts
  if (now - lastRefreshTime < MIN_REFRESH_INTERVAL_MS) {
    console.log("[auth-refresh-dedupe] Refresh throttled, too soon since last attempt")
    return {
      data: { session: null },
      error: {
        __isAuthError: true,
        code: "refresh_throttled",
        message: "Refresh attempt throttled",
        status: 429
      }
    }
  }
  
  // Create new refresh promise
  lastRefreshTime = now
  refreshPromise = refreshFn().finally(() => {
    // Clear the promise after a short delay to allow for race conditions
    setTimeout(() => {
      refreshPromise = null
    }, 100)
  })
  
  try {
    const result = await refreshPromise
    
    // If refresh failed with token not found, clear cookies/storage
    if (result.error && isSupabaseRefreshTokenNotFound(result.error)) {
      console.log("[auth-refresh-dedupe] Refresh token not found, clearing session")
      clearAuthStorage()
    }
    
    return result
  } catch (error) {
    if (isSupabaseRefreshTokenNotFound(error)) {
      clearAuthStorage()
    }
    throw error
  }
}

/**
 * Clear all authentication storage
 */
function clearAuthStorage(): void {
  if (!isBrowser()) return
  
  try {
    // Clear localStorage items
    localStorage.removeItem("ali_session_token")
    localStorage.removeItem("ali_current_session_id")
    localStorage.removeItem("supabase.auth.token")
    
    // Clear sessionStorage items
    sessionStorage.removeItem("supabase.auth.token")
    
    console.log("[auth-refresh-dedupe] Auth storage cleared")
  } catch (error) {
    console.error("[auth-refresh-dedupe] Error clearing auth storage:", error)
  }
}

/**
 * Wrap Supabase auth methods with deduplication
 */
export function applyRefreshDeduping<TClient extends { auth?: any }>(
  client: TClient,
  scope: string
): TClient {
  const auth = (client as any)?.auth
  if (!auth || typeof auth !== "object") return client
  if ((auth as any).__refreshDeduped) return client
  
  ;(auth as any).__refreshDeduped = true
  
  // Wrap getSession with deduplication
  const originalGetSession = auth.getSession?.bind(auth)
  if (typeof originalGetSession === "function") {
    auth.getSession = async (...args: any[]) => {
      // First try the normal getSession
      const result = await originalGetSession(...args)
      
      // If we got a session, return it
      if (result.data?.session) {
        return result
      }
      
      // If no session and we have refreshSession, try with deduplication
      if (auth.refreshSession && !result.data?.session) {
        console.log(`[auth-refresh-dedupe:${scope}] No session, attempting refresh`)
        return dedupedSessionRefresh(() => auth.refreshSession())
      }
      
      return result
    }
  }
  
  // Wrap refreshSession with deduplication
  const originalRefreshSession = auth.refreshSession?.bind(auth)
  if (typeof originalRefreshSession === "function") {
    auth.refreshSession = async (...args: any[]) => {
      return dedupedSessionRefresh(() => originalRefreshSession(...args))
    }
  }
  
  return client
}

/**
 * Middleware-specific deduplication storage
 * Uses a simple in-memory cache for server-side requests
 */
const middlewareRefreshCache = new Map<string, { promise: Promise<any>; timestamp: number }>()
const MIDDLEWARE_CACHE_TTL_MS = 5000

/**
 * Check if there's a pending refresh for this request context
 */
export function getPendingMiddlewareRefresh(requestId: string): Promise<any> | null {
  const cached = middlewareRefreshCache.get(requestId)
  if (!cached) return null
  
  // Check if cache is still valid
  if (Date.now() - cached.timestamp < MIDDLEWARE_CACHE_TTL_MS) {
    return cached.promise
  }
  
  // Cache expired, remove it
  middlewareRefreshCache.delete(requestId)
  return null
}

/**
 * Store a pending refresh promise for deduplication
 */
export function setPendingMiddlewareRefresh(
  requestId: string,
  promise: Promise<any>
): void {
  middlewareRefreshCache.set(requestId, {
    promise,
    timestamp: Date.now()
  })
  
  // Clean up after TTL
  promise.finally(() => {
    setTimeout(() => {
      middlewareRefreshCache.delete(requestId)
    }, MIDDLEWARE_CACHE_TTL_MS)
  })
}

/**
 * Generate a unique request ID for middleware deduplication
 */
export function generateRequestId(request: { headers: { get: (name: string) => string | null } }): string {
  const ip = request.headers.get("x-forwarded-for") || 
             request.headers.get("x-real-ip") || 
             "unknown"
  const userAgent = request.headers.get("user-agent") || "unknown"
  
  // Create a simple hash of IP + User-Agent
  const str = `${ip}:${userAgent}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  
  return `req_${hash}_${Math.floor(Date.now() / 10000)}` // Changes every 10 seconds
}
