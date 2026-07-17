import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * P1: Edge-level route guard.
 *
 * Reads the access_token httpOnly cookie (Edge Runtime CAN read httpOnly cookies).
 * If the cookie is absent on a protected route, redirects to /login.
 *
 * Token VALIDITY is checked by the backend's authenticate middleware.
 * This is a fast-path existence check to prevent protected pages from
 * rendering for unauthenticated users.
 *
 * Protected routes: /dashboard, /staff, /teachers, /students,
 *                   /operations, /finance and all sub-paths.
 * Public routes: /, /login, /api/*, /_next/* (static assets)
 */

const PROTECTED_PATHS = [
  "/dashboard",
  "/staff",
  "/teachers",
  "/students",
  "/operations",
  "/finance",
]

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (protectedPath) => pathname === protectedPath || pathname.startsWith(protectedPath + "/")
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip non-protected paths
  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  // Check for access_token cookie existence
  const accessToken = request.cookies.get("access_token")?.value

  if (!accessToken) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Match all routes except static files and API routes
    // (API routes are protected by the backend, not Next.js middleware)
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
}
