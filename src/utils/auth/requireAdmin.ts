import { NextRequest, NextResponse } from "next/server";
import { userRoles } from "@/models/enum.constants";
import { resolveAuthPayload } from "@/utils/auth/requireAuth";
import type { AuthPayload } from "@/utils/auth/tokens";

export type AdminPayload = AuthPayload;

type RequireAdminResult =
  | { payload: AdminPayload; error?: undefined }
  | { payload?: undefined; error: NextResponse };

/**
 * Guard for admin-only endpoints. Accepts the same two credentials as
 * `requireAuth` (Bearer header, then the httpOnly access-token cookie) and then
 * enforces the ADMIN role, returning a real 401/403 rather than a 200 with an
 * error in the body.
 *
 * Usage:
 *   const auth = requireAdmin(req);
 *   if (auth.error) return auth.error;
 *   const { payload } = auth;
 */
export function requireAdmin(req: NextRequest): RequireAdminResult {
  const payload = resolveAuthPayload(req);

  if (!payload) {
    return {
      error: NextResponse.json(
        { status: 401, message: "Invalid or expired session. Please log in again" },
        { status: 401 },
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
