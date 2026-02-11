import { NextResponse } from "next/server"

function isDebugRouteEnabled(): boolean {
  const explicitFlag = process.env.DEBUG_ROUTES_ENABLED === "true"
  const isDevelopment = process.env.NODE_ENV !== "production"
  return explicitFlag || isDevelopment
}

export function blockIfDebugRouteDisabled(): NextResponse | null {
  if (isDebugRouteEnabled()) {
    return null
  }

  // Return 404 to avoid exposing internal debug surface in production.
  return new NextResponse("Not Found", { status: 404 })
}

