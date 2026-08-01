import { createHash, randomBytes } from "crypto";
import jwt from "jsonwebtoken";

/**
 * Token/cookie primitives shared by login, refresh, logout, the API guards and
 * the server-component session helper. Pure — no database access, so it can be
 * imported from anywhere that runs in the Node runtime.
 *
 * Two tokens:
 *   access_token   a short-lived signed JWT. Sent as `Authorization: Bearer` by
 *                  client components (prop-drilled from server components) AND
 *                  carried automatically as a cookie on same-origin fetches.
 *   refresh_token  a long-lived opaque random string. Only its sha256 is stored
 *                  (see models/AuthSession), it is rotated on every use, and it
 *                  is the only thing that survives a browser restart.
 */

/**
 * ROLLOUT NOTE: ships equal to the refresh lifetime on purpose. Verify in
 * production that AuthSession rows are being created and rotated, THEN drop
 * this to `60 * 60` in a follow-up. If anything in the refresh path is wrong, a
 * 30-day access token means nobody notices while it gets fixed; a 60-minute one
 * locks every employee out within the hour.
 */
export const ACCESS_TTL_SECONDS = 30 * 24 * 60 * 60;
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Above this much remaining life, /api/auth/refresh returns without touching the DB. */
export const ROTATE_UNDER_SECONDS = 20 * 60;

/**
 * Grace window for concurrent rotations. Two tabs (or the keeper and a
 * navigation) can present the same refresh token milliseconds apart; treating
 * the second as token theft would log a real employee out. Inside this window
 * the sibling gets its own leaf on the same family instead.
 */
export const ROTATION_LEEWAY_MS = 30_000;

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";

/**
 * Cookies the pre-refresh-token build set and that nothing should read anymore.
 * `role` in particular was client-writable and gated the admin shell.
 * Actively cleared on login/refresh/logout so stale jars drain themselves.
 */
export const LEGACY_COOKIES = ["role", "email", "userId"] as const;

/** UI-state cookies that used to be the dashboard's source of truth. */
export const APP_STATE_COOKIES = ["shiftStatus", "visitStatus", "currentVisit"] as const;

export type AuthPayload = {
  _id: string;
  email: string;
  role: string;
  /** AuthSession._id of the refresh row this token was minted from. */
  sid?: string;
  exp?: number;
  iat?: number;
};

export function signAccessToken(payload: AuthPayload): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET environment variable is not defined");
  const { _id, email, role, sid } = payload;
  return jwt.sign({ _id, email, role, sid }, secret, { expiresIn: ACCESS_TTL_SECONDS });
}

/** Verify an access token. Returns null rather than throwing on any failure. */
export function verifyAccessToken(token?: string | null): AuthPayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.AUTH_SECRET as string) as AuthPayload;
  } catch {
    return null;
  }
}

/** Seconds of life left on a verified payload (0 when absent). */
export function secondsUntilExpiry(payload: AuthPayload | null): number {
  if (!payload?.exp) return 0;
  return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
}

export const hashToken = (raw: string) => createHash("sha256").update(raw).digest("hex");

export function newRefreshToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

const baseCookie = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/**
 * Both auth cookies persist for the REFRESH lifetime, not the access token's.
 *
 * This is deliberate: the access cookie must outlive its own JWT so the cookie
 * survives a browser restart and middleware's presence gate still sees a
 * session. Presence is not validity — every route still verifies the signature.
 * (The original bug was the opposite mistake: no maxAge at all, making these
 * browser-session cookies that died the moment the browser closed.)
 */
export const authCookieOptions = { ...baseCookie, maxAge: REFRESH_TTL_SECONDS };

export const clearCookieOptions = { ...baseCookie, maxAge: 0 };

/** Legacy cookies were never httpOnly, so clear them the way they were set. */
export const clearLegacyCookieOptions = { ...clearCookieOptions, httpOnly: false };
