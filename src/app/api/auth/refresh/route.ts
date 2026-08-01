import { NextRequest, NextResponse } from "next/server";
import { initDb } from "@/lib/mongoose";
import { createSessionFamily, rotate } from "@/utils/auth/session.server";
import {
  ACCESS_COOKIE,
  APP_STATE_COOKIES,
  LEGACY_COOKIES,
  REFRESH_COOKIE,
  ROTATE_UNDER_SECONDS,
  authCookieOptions,
  clearCookieOptions,
  clearLegacyCookieOptions,
  secondsUntilExpiry,
  signAccessToken,
  verifyAccessToken,
} from "@/utils/auth/tokens";

export const dynamic = "force-dynamic";

/** 401 + drain the jar, so a dead session can't linger and bounce /login forever. */
function fail(reason: string) {
  const res = NextResponse.json(
    { status: 401, reason, message: "Invalid or expired session. Please log in again" },
    { status: 401 },
  );
  res.cookies.set(ACCESS_COOKIE, "", clearCookieOptions);
  res.cookies.set(REFRESH_COOKIE, "", clearCookieOptions);
  for (const name of LEGACY_COOKIES) res.cookies.set(name, "", clearLegacyCookieOptions);
  for (const name of APP_STATE_COOKIES) res.cookies.set(name, "", clearLegacyCookieOptions);
  return res;
}

/**
 * Exchange the refresh cookie for a fresh access/refresh pair.
 *
 * Called by <SessionKeeper /> on mount, on tab focus, and on a timer. Because
 * the keeper pings far more often than the access token expires, the common
 * case MUST be free — hence the early return below.
 */
export async function POST(req: NextRequest) {
  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;
  const payload = verifyAccessToken(access);

  // Cheap path: plenty of life left. No database round trip, no rotation.
  if (payload && refresh && secondsUntilExpiry(payload) > ROTATE_UNDER_SECONDS) {
    return NextResponse.json({ userToken: access, rotated: false }, { status: 200 });
  }

  await initDb();

  if (refresh) {
    const result = await rotate(refresh, req);
    if (!result.ok) return fail(result.reason);

    const res = NextResponse.json({ userToken: result.userToken, rotated: true }, { status: 200 });
    res.cookies.set(ACCESS_COOKIE, result.userToken, authCookieOptions);
    res.cookies.set(REFRESH_COOKIE, result.refreshRaw, authCookieOptions);
    for (const name of LEGACY_COOKIES) res.cookies.set(name, "", clearLegacyCookieOptions);
    return res;
  }

  /**
   * ---- Legacy upgrade — DELETE THIS BRANCH ~30 DAYS AFTER DEPLOY ----
   *
   * Users from before this feature hold a signed (100-year) access token and no
   * AuthSession row. Trading it for a real session on their first page load is
   * what makes this deploy log nobody out.
   *
   * It is a real if bounded risk: those old tokens were not httpOnly, so one
   * stolen via XSS can be exchanged for a full refresh token while the window
   * is open. Hence the env gate — turn it off once the fleet has rolled over.
   */
  if (payload && process.env.ALLOW_LEGACY_TOKEN_UPGRADE === "1") {
    const { raw, doc } = await createSessionFamily(payload._id, req);
    const userToken = signAccessToken({
      _id: payload._id,
      email: payload.email,
      role: payload.role,
      sid: String(doc._id),
    });

    const res = NextResponse.json({ userToken, rotated: true, upgraded: true }, { status: 200 });
    res.cookies.set(ACCESS_COOKIE, userToken, authCookieOptions);
    res.cookies.set(REFRESH_COOKIE, raw, authCookieOptions);
    for (const name of LEGACY_COOKIES) res.cookies.set(name, "", clearLegacyCookieOptions);
    return res;
  }

  return fail("NO_SESSION");
}
