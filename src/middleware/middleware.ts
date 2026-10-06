import { NextRequest, NextResponse } from 'next/server'

/**
 * Middleware — extracts tg_uid cookie (set by /api/auth) and forwards
 * it as X-User-Id header for downstream API routes that need to know
 * the authenticated user.
 *
 * Skips /api/auth (which sets the cookie itself) and non-API routes.
 */
export function middleware(req: NextRequest): NextResponse {
  // Only run for /api/* routes except /api/auth
  if (!req.nextUrl.pathname.startsWith('/api/') ||
      req.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const tgUid = req.cookies.get('tg_uid')?.value
  const themeColor = req.cookies.get('theme_color')?.value

  if (tgUid || themeColor) {
    const requestHeaders = new Headers(req.headers)
    if (tgUid) requestHeaders.set('x-user-id', tgUid)
    if (themeColor) requestHeaders.set('x-theme-color', themeColor)
    return NextResponse.next({
      request: { headers: requestHeaders },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
