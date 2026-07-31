import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export type AuthPayload = { _id: string; email: string; role: string };

type RequireAuthResult =
  | { payload: AuthPayload; error?: undefined }
  | { payload?: undefined; error: NextResponse };

/**
 * Inline JWT guard for endpoints open to any authenticated user (no role
 * enforcement). Verifies the Bearer token and returns the decoded payload so
 * the caller can scope results itself via `payload.role` / `payload._id`
 * (e.g. admins see everything, employees only their own rows).
 *
 * For admin-only endpoints use `requireAdmin` instead.
 *
 * Usage:
 *   const auth = requireAuth(req);
 *   if (auth.error) return auth.error;
 *   const { payload } = auth;
 */
export function requireAuth(req: NextRequest): RequireAuthResult {
  const authHeader = req.headers.get("authorization");
  const userToken = authHeader?.split(" ")[1];

  if (!userToken) {
    return {
      error: NextResponse.json(
        { status: 401, message: "Session has timed out. Please log in to use Mabrook System" },
        { status: 401 },
      ),
    };
  }

  try {
    const payload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as AuthPayload;
    return { payload };
  } catch {
    return {
      error: NextResponse.json(
        { status: 401, message: "Invalid or expired session. Please log in again" },
        { status: 401 },
      ),
    };
  }
}
