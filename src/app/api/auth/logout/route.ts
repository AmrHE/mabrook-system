// app/api/logout/route.ts
import { initDb } from "@/lib/mongoose";
import { AuthSession } from "@/models/AuthSession";
import { revokeFamily } from "@/utils/auth/session.server";
import {
  ACCESS_COOKIE,
  APP_STATE_COOKIES,
  LEGACY_COOKIES,
  REFRESH_COOKIE,
  clearCookieOptions,
  clearLegacyCookieOptions,
  hashToken,
  verifyAccessToken,
} from "@/utils/auth/tokens";
import { NextRequest, NextResponse } from "next/server";

/**
 * Log out: revoke the refresh family and drain the cookie jar.
 *
 * Deliberately does NOT end the employee's shift anymore. Logging out is not
 * clocking out — an accidental logout used to silently truncate someone's paid
 * hours. The shift stays open, the employee resumes it with "استئناف الدوام",
 * and `cron/close-stale-shifts` remains the safety net for a genuinely
 * abandoned shift.
 */
export async function POST(req: NextRequest) {
  await initDb();

  const raw = req.cookies.get(REFRESH_COOKIE)?.value;

  // Identify from a VERIFIED token, never from a cookie the client can write.
  // The previous version trusted a plain `userId` cookie, so a forged one let
  // anybody force-close another employee's shift.
  const payload =
    verifyAccessToken(req.cookies.get(ACCESS_COOKIE)?.value) ??
    verifyAccessToken(req.headers.get("authorization")?.split(" ")[1]);

  if (raw) {
    const row = await AuthSession.findOne({ tokenHash: hashToken(raw) });
    if (row) await revokeFamily(row.familyId, "LOGOUT");
  } else if (payload?.sid) {
    const row = await AuthSession.findById(payload.sid);
    if (row) await revokeFamily(row.familyId, "LOGOUT");
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(ACCESS_COOKIE, "", clearCookieOptions);
  res.cookies.set(REFRESH_COOKIE, "", clearCookieOptions);
  for (const name of LEGACY_COOKIES) res.cookies.set(name, "", clearLegacyCookieOptions);
  for (const name of APP_STATE_COOKIES) res.cookies.set(name, "", clearLegacyCookieOptions);
  return res;
}
