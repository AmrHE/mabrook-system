import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, verifyAccessToken, type AuthPayload } from "@/utils/auth/tokens";

export type { AuthPayload };

type RequireAuthResult =
  | { payload: AuthPayload; error?: undefined }
  | { payload?: undefined; error: NextResponse };

/** Shared by requireAuth and requireAdmin. */
export function resolveAuthPayload(req: NextRequest): AuthPayload | null {
  // 1. Bearer header — what every prop-drilled client call site sends, and the
  //    only credential a server component's self-fetch can carry.
  const fromHeader = verifyAccessToken(req.headers.get("authorization")?.split(" ")[1]);
  if (fromHeader) return fromHeader;

  // 2. Cookie fallback. Browsers attach the httpOnly access_token to every
  //    same-origin fetch, and <SessionKeeper /> keeps it fresh. So a Bearer that
  //    went stale in a tab left open for hours still resolves here — which is
  //    what lets the token lifetime shrink without touching 60+ call sites.
  return verifyAccessToken(req.cookies.get(ACCESS_COOKIE)?.value);
}

/**
 * Guard for endpoints open to any authenticated user (no role enforcement).
 * Returns the decoded payload so the caller can scope results itself via
 * `payload.role` / `payload._id` (e.g. admins see everything, employees only
 * their own rows).
 *
 * For admin-only endpoints use `requireAdmin` instead.
 *
 * Usage:
 *   const auth = requireAuth(req);
 *   if (auth.error) return auth.error;
 *   const { payload } = auth;
 */
export function requireAuth(req: NextRequest): RequireAuthResult {
  const payload = resolveAuthPayload(req);
  if (payload) return { payload };

  // `status` is duplicated in the body because older clients check
  // `data.status !== 200` rather than `res.ok`.
  return {
    error: NextResponse.json(
      { status: 401, message: "Invalid or expired session. Please log in again" },
      { status: 401 },
    ),
  };
}
