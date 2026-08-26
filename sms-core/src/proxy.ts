import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Edge-level route guard.
 * /setup is public so first-start can run before any admin session exists.
 */

const PROTECTED_PATHS = [
  "/dashboard",
  "/staff",
  "/teachers",
  "/students",
  "/operations",
  "/finance",
  "/portal",
  "/no-access",
]

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (protectedPath) => pathname === protectedPath || pathname.startsWith(protectedPath + "/")
  )
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === "/setup" || pathname.startsWith("/setup/")) {
    return NextResponse.next()
  }

  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  const accessToken = request.cookies.get("access_token")?.value
  const refreshToken = request.cookies.get("refresh_token")?.value

  if (!accessToken && !refreshToken) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
}
