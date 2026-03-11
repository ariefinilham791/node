import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const COOKIE_NAME = "dc_token"

export function middleware(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  const isLoggedIn = Boolean(token?.length)
  const isLoginPage = request.nextUrl.pathname === "/login"

  if (isLoginPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    return NextResponse.next()
  }

  const protectedPaths = [
    "/dashboard",
    "/servers",
    "/monitoring",
    "/component-types",
    "/locations",
    "/users",
    "/export",
  ]
  const isProtected =
    protectedPaths.some((p) => request.nextUrl.pathname.startsWith(p)) ||
    request.nextUrl.pathname === "/"

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/dashboard",
    "/dashboard/:path*",
    "/servers",
    "/servers/:path*",
    "/monitoring",
    "/monitoring/:path*",
    "/component-types",
    "/component-types/:path*",
    "/locations",
    "/locations/:path*",
    "/users",
    "/users/:path*",
    "/export",
    "/export/:path*",
  ],
}
