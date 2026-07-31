import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { userRoles } from "@/models/enum.constants";

export type AdminPayload = { _id: string; email: string; role: string };

type RequireAdminResult =
  | { payload: AdminPayload; error?: undefined }
  | { payload?: undefined; error: NextResponse };

/**
 * Inline JWT guard for admin-only endpoints. Mirrors the copy-pasted guard in
 * the existing get routes (e.g. src/app/api/user/get-all/route.ts) but returns
 * proper HTTP status codes so a non-admin caller gets a real 401/403.
 *
 * Usage:
 *   const auth = requireAdmin(req);
 *   if (auth.error) return auth.error;
 *   const { payload } = auth;
 */
export function requireAdmin(req: NextRequest): RequireAdminResult {
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

  let payload: AdminPayload;
  try {
    payload = jwt.verify(userToken, process.env.AUTH_SECRET as string) as AdminPayload;
  } catch {
    return {
      error: NextResponse.json(
        { status: 401, message: "Invalid or expired session. Please log in again" },
        { status: 401 },
      ),
    };
  }

  if (!payload) {
    return {
      error: NextResponse.json(
        { status: 400, message: "Cannot identify the user Please re-login and try again" },
        { status: 400 },
      ),
    };
  }

  if (payload.role !== userRoles.ADMIN) {
    return {
      error: NextResponse.json(
        { status: 403, message: "This Action is only allowed for Admins" },
        { status: 403 },
      ),
    };
  }

  return { payload };
}
