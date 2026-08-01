import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "access_token";
const REFRESH_COOKIE = "refresh_token";

/**
 * Read `exp` out of a JWT payload WITHOUT verifying the signature.
 *
 * Middleware runs in the edge runtime, where neither `jsonwebtoken`'s Node
 * crypto nor Mongoose is available — only Web APIs like `atob` and
 * `TextDecoder`. JWT payloads are base64url, so `-`/`_` must be translated and
 * the string re-padded; `atob` throws on unpadded input.
 *
 * SECURITY: the result only decides whether the page SHELL is worth rendering.
 * Every byte of data comes from an /api route that runs a real `jwt.verify` in
 * the Node runtime. Never authorize on this value.
 */
function readExp(token: string): number | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const json = JSON.parse(new TextDecoder().decode(bytes));
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

/**
 * Presence gate only.
 *
 * It deliberately does NOT redirect to a refresh endpoint. `<Link>` prefetching
 * fires RSC requests through middleware, so every hovered link would trigger a
 * token rotation, and redirecting an RSC request to a non-Next URL degrades the
 * soft navigation into a full page reload. `getServerSession()` already mints a
 * fresh token during render in the Node runtime, so the redirect would buy
 * nothing anyway.
 */
export function middleware(request: NextRequest) {
  // A live refresh cookie IS the session — the access token being stale is not
  // a reason to bounce anyone, because the render path can mint a new one.
  if (request.cookies.get(REFRESH_COOKIE)?.value) {
    return NextResponse.next();
  }

  // No refresh cookie: only pre-refresh-token (legacy) sessions land here.
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  if (access) {
    const exp = readExp(access);
    if (exp === null || exp * 1000 > Date.now()) return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - login (excluded because we don't want to protect the login page)
     * - api (route handlers guard themselves; excluding them also makes a
     *   redirect loop through /api/auth/* impossible to construct)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|login|_next/static|_next/image|favicon.ico).*)',
  ],
};
